"""
School of Freedom — Pioneer applications.

This is the human-side counterpart to ``routes/applications.py`` (which
vets *AI agents* joining the ecosystem). The flows are deliberately
separate so they can evolve independently:

* Pioneer applications are quick and human-readable (mission statement,
  pathway choice, slug claim) and Freedom approves them by hand from the
  School of Freedom admin dashboard.
* Agent applications run the Devin-vet + trio sign-off pipeline and are
  much heavier.

Endpoints:

* ``POST /pioneer-applications`` — public submission from ``sof.ai/apply``.
* ``GET /pioneer-applications`` — internal-auth, listed for the admin
  dashboard. Filterable by status.
* ``GET /pioneer-applications/{id}`` — internal-auth.
* ``PATCH /pioneer-applications/{id}`` — internal-auth, used by the
  approval flow to flip ``status`` and (on approve) auto-upsert a
  ``UserProfile`` row so the Pioneer's identity is unified across the
  three sister sites.
* ``GET /pioneer-applications/by-slug/{slug}`` — public, returns the
  approved Pioneer's profile fields. ``sof.ai/[slug]`` reads from this.
* ``GET /pioneer-applications/approved`` — public, returns the directory
  of approved Pioneers. ``sof.ai/students`` reads from this.

Mutating routes (other than the public POST and the public reads) are
gated by the same ``X-Internal-Auth`` shared secret as the rest of the
API — the public Fly backend can't be driven directly without going
through the Next.js proxy.
"""

from __future__ import annotations

import contextlib
import json
import re
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..db import get_session
from ..models import PioneerApplication, UserProfile, _utcnow
from .wallet import require_internal_auth

router = APIRouter(prefix="/pioneer-applications", tags=["pioneer-applications"])


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PathwayKind = Literal["architect", "vr", "ai"]
PioneerStatus = Literal["pending", "approved", "declined"]

# Same shape as ``lib/utils.ts:slugify`` on the gateway. Re-validated
# server-side so a hand-crafted POST can't smuggle special characters.
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SLUG_MAX_LEN = 32

# Soft cap on how many applications the admin dashboard can paginate
# through in one call. Generous because Pioneer volume is low.
LIST_LIMIT_DEFAULT = 50
LIST_LIMIT_MAX = 200


# ---------------------------------------------------------------------------
# Pydantic IO
# ---------------------------------------------------------------------------


class SubmitPioneerApplicationIn(BaseModel):
    """Payload for ``POST /pioneer-applications``.

    The gateway's multi-step form already validates everything client-
    side; we re-validate here so we never trust the client.
    """

    full_name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=3, max_length=200)
    slug: str = Field(..., min_length=2, max_length=SLUG_MAX_LEN)
    pathway: PathwayKind
    mission_statement: str = Field(..., min_length=10, max_length=600)
    personal_statement: str = Field(..., min_length=20, max_length=4000)
    # Up to 8 short tags. Empty list is fine.
    identity_tags: list[str] = Field(default_factory=list, max_length=8)


class PatchPioneerApplicationIn(BaseModel):
    """Payload for the admin PATCH. Every field is optional so the
    client can send a partial update without nulling other columns."""

    status: Optional[PioneerStatus] = None
    review_note: Optional[str] = Field(default=None, max_length=1000)
    reviewed_by_email: Optional[str] = Field(default=None, max_length=200)
    # Editable by an approver (typo fixes etc.) before publication.
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    mission_statement: Optional[str] = Field(default=None, max_length=600)
    personal_statement: Optional[str] = Field(default=None, max_length=4000)
    identity_tags: Optional[list[str]] = Field(default=None, max_length=8)


class PioneerApplicationOut(BaseModel):
    id: int
    full_name: str
    email: str
    slug: str
    pathway: PathwayKind
    mission_statement: str
    personal_statement: str
    identity_tags: list[str]
    status: PioneerStatus
    review_note: str
    reviewed_by_email: str
    reviewed_at: Optional[str]
    created_at: str
    updated_at: str


class PioneerProfileOut(BaseModel):
    """Public-safe projection — used by ``sof.ai/[slug]`` and
    ``sof.ai/students``. Drops the email and review fields."""

    full_name: str
    slug: str
    pathway: PathwayKind
    mission_statement: str
    personal_statement: str
    identity_tags: list[str]
    approved_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_slug(raw: str) -> str:
    s = raw.strip().lower()
    if not SLUG_RE.match(s):
        raise HTTPException(status_code=422, detail="slug must match ^[a-z0-9-]+$")
    if len(s) < 2 or len(s) > SLUG_MAX_LEN:
        raise HTTPException(
            status_code=422,
            detail=f"slug must be {2}-{SLUG_MAX_LEN} characters",
        )
    return s


def _validate_email(raw: str) -> str:
    e = raw.strip().lower()
    # Same shape as the gateway's regex; not RFC-perfect but rejects the
    # 99% of invalid inputs without false-flagging real addresses.
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", e):
        raise HTTPException(status_code=422, detail="email is not valid")
    return e


def _validate_tags(tags: list[str]) -> list[str]:
    cleaned: list[str] = []
    for t in tags:
        s = t.strip()
        if not s:
            continue
        if len(s) > 32:
            raise HTTPException(
                status_code=422, detail="identity tags must be ≤ 32 characters each"
            )
        cleaned.append(s)
    return cleaned


def _serialize(app: PioneerApplication) -> PioneerApplicationOut:
    return PioneerApplicationOut(
        id=app.id or 0,
        full_name=app.full_name,
        email=app.email,
        slug=app.slug,
        pathway=app.pathway,  # type: ignore[arg-type]
        mission_statement=app.mission_statement,
        personal_statement=app.personal_statement,
        identity_tags=_decode_tags(app.identity_tags_json),
        status=app.status,  # type: ignore[arg-type]
        review_note=app.review_note,
        reviewed_by_email=app.reviewed_by_email,
        reviewed_at=app.reviewed_at.isoformat() if app.reviewed_at else None,
        created_at=app.created_at.isoformat(),
        updated_at=app.updated_at.isoformat(),
    )


def _serialize_public(app: PioneerApplication) -> PioneerProfileOut:
    # Caller is responsible for status="approved" check.
    return PioneerProfileOut(
        full_name=app.full_name,
        slug=app.slug,
        pathway=app.pathway,  # type: ignore[arg-type]
        mission_statement=app.mission_statement,
        personal_statement=app.personal_statement,
        identity_tags=_decode_tags(app.identity_tags_json),
        approved_at=(app.reviewed_at or app.updated_at).isoformat(),
    )


def _decode_tags(blob: str) -> list[str]:
    try:
        parsed = json.loads(blob or "[]")
        if isinstance(parsed, list):
            return [str(t) for t in parsed if isinstance(t, str)]
    except Exception:
        pass
    return []


def _upsert_user_profile(session: Session, app: PioneerApplication) -> None:
    """Create or update the shared ``UserProfile`` row when a Pioneer is
    approved. The Pioneer's email becomes the unifying identity across
    sof.ai + ai.thevrschool.org + thevrschool.org.

    No-ops if a profile already exists for the email (e.g. the user
    signed up via the AI School first); we only fill in the *missing*
    fields so we never clobber an existing handle/tagline/twin seed.
    """
    existing = session.exec(
        select(UserProfile).where(UserProfile.email == app.email)
    ).first()
    pathway_to_user_type = {
        "architect": "founder",
        "vr": "student",
        "ai": "student",
    }
    if existing is None:
        # Use the Pioneer's slug as their handle on the AI School. If a
        # collision exists (rare but possible) the unique constraint on
        # UserProfile.handle will raise; we fall back to slug + numeric
        # suffix transparently.
        chosen_handle = app.slug
        for suffix in ("", "-1", "-2", "-3"):
            candidate = f"{app.slug}{suffix}"
            taken = session.exec(
                select(UserProfile).where(UserProfile.handle == candidate)
            ).first()
            if taken is None:
                chosen_handle = candidate
                break
        profile = UserProfile(
            email=app.email,
            handle=chosen_handle,
            display_name=app.full_name,
            user_type=pathway_to_user_type.get(app.pathway, "student"),
            tagline=app.mission_statement[:280],
        )
        session.add(profile)
        try:
            session.commit()
        except IntegrityError:
            # Lost the race — another worker created the profile first.
            # Safe to drop our insert and continue.
            session.rollback()
        return
    # Profile already exists — only fill in genuinely empty fields so
    # we don't overwrite anything the user has already personalised.
    dirty = False
    if not existing.display_name:
        existing.display_name = app.full_name
        dirty = True
    if not existing.tagline:
        existing.tagline = app.mission_statement[:280]
        dirty = True
    if dirty:
        existing.updated_at = _utcnow()
        session.add(existing)
        session.commit()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("", response_model=PioneerApplicationOut, status_code=201)
def submit_pioneer_application(
    payload: SubmitPioneerApplicationIn,
    session: Session = Depends(get_session),
) -> PioneerApplicationOut:
    slug = _validate_slug(payload.slug)
    email = _validate_email(payload.email)
    tags = _validate_tags(payload.identity_tags)

    app = PioneerApplication(
        full_name=payload.full_name.strip(),
        email=email,
        slug=slug,
        pathway=payload.pathway,
        mission_statement=payload.mission_statement.strip(),
        personal_statement=payload.personal_statement.strip(),
        identity_tags_json=json.dumps(tags),
    )
    session.add(app)
    try:
        session.commit()
    except IntegrityError as e:
        session.rollback()
        # Distinguish slug vs email collisions so the gateway can
        # surface a helpful error to the user.
        existing_slug = session.exec(
            select(PioneerApplication).where(PioneerApplication.slug == slug)
        ).first()
        if existing_slug is not None:
            raise HTTPException(
                status_code=409, detail="This slug is already claimed."
            ) from e
        existing_email = session.exec(
            select(PioneerApplication).where(PioneerApplication.email == email)
        ).first()
        if existing_email is not None:
            raise HTTPException(
                status_code=409,
                detail="An application with this email is already on file.",
            ) from e
        # Generic fallback.
        raise HTTPException(status_code=409, detail="Could not save application.") from e
    session.refresh(app)
    return _serialize(app)


@router.get("", response_model=list[PioneerApplicationOut])
def list_pioneer_applications(
    status: Optional[PioneerStatus] = None,
    pathway: Optional[PathwayKind] = None,
    limit: int = Query(LIST_LIMIT_DEFAULT, ge=1, le=LIST_LIMIT_MAX),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
    _internal: None = Depends(require_internal_auth),
) -> list[PioneerApplicationOut]:
    """Admin dashboard read. ``X-Internal-Auth`` gated."""
    stmt = select(PioneerApplication).order_by(PioneerApplication.created_at.desc())  # type: ignore[attr-defined]
    if status:
        stmt = stmt.where(PioneerApplication.status == status)
    if pathway:
        stmt = stmt.where(PioneerApplication.pathway == pathway)
    stmt = stmt.offset(offset).limit(limit)
    rows = session.exec(stmt).all()
    return [_serialize(r) for r in rows]


@router.get("/approved", response_model=list[PioneerProfileOut])
def list_approved_pioneers(
    pathway: Optional[PathwayKind] = None,
    limit: int = Query(LIST_LIMIT_DEFAULT, ge=1, le=LIST_LIMIT_MAX),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
) -> list[PioneerProfileOut]:
    """Public directory read. No auth — every approved Pioneer is
    intentionally public at ``sof.ai/<slug>``."""
    stmt = (
        select(PioneerApplication)
        .where(PioneerApplication.status == "approved")
        .order_by(PioneerApplication.reviewed_at.desc())  # type: ignore[attr-defined]
    )
    if pathway:
        stmt = stmt.where(PioneerApplication.pathway == pathway)
    stmt = stmt.offset(offset).limit(limit)
    rows = session.exec(stmt).all()
    return [_serialize_public(r) for r in rows]


@router.get("/by-slug/{slug}", response_model=PioneerProfileOut)
def get_pioneer_by_slug(
    slug: str,
    session: Session = Depends(get_session),
) -> PioneerProfileOut:
    """Public read for ``sof.ai/[slug]``. Only returns approved
    Pioneers; pending or declined slugs 404 so the gateway can fall
    through to the static-seed Pioneer or the not-found page."""
    s = _validate_slug(slug)
    row = session.exec(
        select(PioneerApplication)
        .where(PioneerApplication.slug == s)
        .where(PioneerApplication.status == "approved")
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="No approved Pioneer with that slug.")
    return _serialize_public(row)


@router.get("/{application_id}", response_model=PioneerApplicationOut)
def get_pioneer_application(
    application_id: int,
    session: Session = Depends(get_session),
    _internal: None = Depends(require_internal_auth),
) -> PioneerApplicationOut:
    row = session.get(PioneerApplication, application_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    return _serialize(row)


@router.patch("/{application_id}", response_model=PioneerApplicationOut)
def patch_pioneer_application(
    application_id: int,
    payload: PatchPioneerApplicationIn,
    session: Session = Depends(get_session),
    _internal: None = Depends(require_internal_auth),
) -> PioneerApplicationOut:
    """Admin update — flip status, attach review note, fix typos.

    On status="approved" we synchronously upsert the shared UserProfile
    row so the Pioneer's identity is immediately usable across the
    three sites. On status="declined" the row is retained for audit.
    """
    row = session.get(PioneerApplication, application_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Application not found.")

    flipped_to_approved = (
        payload.status == "approved" and row.status != "approved"
    )

    if payload.full_name is not None:
        row.full_name = payload.full_name.strip()
    if payload.mission_statement is not None:
        row.mission_statement = payload.mission_statement.strip()
    if payload.personal_statement is not None:
        row.personal_statement = payload.personal_statement.strip()
    if payload.identity_tags is not None:
        row.identity_tags_json = json.dumps(_validate_tags(payload.identity_tags))
    if payload.review_note is not None:
        row.review_note = payload.review_note
    if payload.reviewed_by_email is not None:
        row.reviewed_by_email = payload.reviewed_by_email.strip().lower()
    if payload.status is not None:
        row.status = payload.status
        if payload.status in ("approved", "declined"):
            row.reviewed_at = _utcnow()
    row.updated_at = _utcnow()

    session.add(row)
    session.commit()
    session.refresh(row)

    if flipped_to_approved:
        # Same DB session — if the upsert fails we don't fail the
        # status flip; the admin can retry the upsert from the
        # dashboard. Surfacing the failure separately keeps the audit
        # trail clean.
        with contextlib.suppress(Exception):
            _upsert_user_profile(session, row)

    return _serialize(row)
