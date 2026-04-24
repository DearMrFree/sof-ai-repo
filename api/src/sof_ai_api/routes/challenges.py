"""Challenges — the user-facing feedback loop.

Every submission captured here flows back into curriculum + app design.
The intent: a student taking Devin's course should be able to log every
friction point in one click and watch it progress from "new" → "shipped".

Also exposes a public endpoint (``POST /challenges/public``) that does not
require a NextAuth session — this is the "let the whole internet leave
feedback" door, protected by a honeypot field, stricter body limit, and
a per-email rate limit. It's how external humans (e.g. Brandon Bayquen)
can submit UI/UX feedback without first creating an account.
"""

import re
import threading
from collections import deque
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlmodel import Session, desc, select

from ..db import get_session
from ..models import Challenge, ChallengeClaim

router = APIRouter(prefix="/challenges", tags=["challenges"])

ALLOWED_TAGS = {"confusing", "broken", "missing", "question", "idea"}
ALLOWED_STATUSES = {"new", "triaged", "building", "shipped"}
# Tags the triage board considers "actionable" for Devin pickup — all but
# "question" (which usually wants a human answer, not a code change).
ACTIONABLE_TAGS = {"broken", "missing", "idea", "confusing"}

# Per-email rate limiting for the public endpoint. Kept in-memory — process
# local is acceptable because Fly deploys a single machine in v1; when we
# scale out we'll move this to the DB. A lock guards the structure against
# concurrent requests from the same email.
PUBLIC_RATE_LIMIT_MAX = 5
PUBLIC_RATE_LIMIT_WINDOW = timedelta(hours=24)
_public_rate_lock = threading.Lock()
_public_rate: dict[str, deque[datetime]] = {}

_HANDLE_ILLEGAL_RE = re.compile(r"[^a-z0-9-]")


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _slugify_handle(raw: str) -> str:
    """Best-effort, non-unique handle derivation from a name or email local.

    Returns a lowercase, hyphenated, 1-60 char handle. Non-unique by design:
    the Challenge model stores ``handle`` just for display so collisions are
    harmless; the stable identity comes from ``user_id``.
    """
    base = raw.strip().lower()
    if "@" in base:
        base = base.split("@", 1)[0]
    base = re.sub(r"\s+", "-", base)
    base = _HANDLE_ILLEGAL_RE.sub("", base)
    base = re.sub(r"-+", "-", base).strip("-")
    if not base:
        base = "friend"
    return base[:60]


def _public_rate_ok(email_key: str) -> bool:
    """Return True and record a hit if the caller is under the limit."""
    now = _utcnow()
    cutoff = now - PUBLIC_RATE_LIMIT_WINDOW
    with _public_rate_lock:
        q = _public_rate.setdefault(email_key, deque())
        # Prune stale hits so the deque doesn't grow without bound.
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= PUBLIC_RATE_LIMIT_MAX:
            return False
        q.append(now)
        return True


class CreateChallengeRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=120)
    handle: str = Field(..., min_length=1, max_length=80)
    body: str = Field(..., min_length=3, max_length=2000)
    tag: str = Field(..., min_length=1, max_length=20)
    page_url: str | None = Field(default=None, max_length=500)
    program_slug: str | None = Field(default=None, max_length=120)
    lesson_slug: str | None = Field(default=None, max_length=120)

    @field_validator("page_url")
    @classmethod
    def _validate_page_url(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        # Only allow http(s). Rendering this value as an anchor href elsewhere
        # means a javascript: / data: / vbscript: scheme would execute on
        # click even with target="_blank" (not a reliable defense across
        # browsers). Reject at the API boundary.
        lowered = v.lower()
        if not (lowered.startswith("http://") or lowered.startswith("https://")):
            raise ValueError("page_url must be an http(s) URL")
        return v


class PublicChallengeRequest(BaseModel):
    """Unauthenticated feedback from the open web.

    ``website`` is a honeypot — legitimate browsers leave it empty because
    the field is rendered ``display: none`` / ``hidden`` in the modal. Bots
    that fill every field trip it and get a 400. This is a cheap first line
    of defense; the real ones (rate limit, length cap) do the heavier work.
    """

    email: EmailStr
    name: str | None = Field(default=None, max_length=120)
    body: str = Field(..., min_length=3, max_length=1000)
    tag: str = Field(..., min_length=1, max_length=20)
    page_url: str | None = Field(default=None, max_length=500)
    program_slug: str | None = Field(default=None, max_length=120)
    lesson_slug: str | None = Field(default=None, max_length=120)
    # Honeypot — must be empty.
    website: str | None = Field(default=None, max_length=500)

    @field_validator("page_url")
    @classmethod
    def _validate_page_url(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        lowered = v.lower()
        if not (lowered.startswith("http://") or lowered.startswith("https://")):
            raise ValueError("page_url must be an http(s) URL")
        return v


class UpdateStatusRequest(BaseModel):
    status: str = Field(..., min_length=1, max_length=20)


class ClaimChallengeRequest(BaseModel):
    claimer_type: str = Field(..., min_length=1, max_length=20)  # "user" | "agent"
    claimer_id: str = Field(..., min_length=1, max_length=120)
    pr_url: str | None = Field(default=None, max_length=500)

    @field_validator("pr_url")
    @classmethod
    def _validate_pr_url(cls, v: str | None) -> str | None:
        """Defence-in-depth: only allow http(s) URLs with a host.

        The triage board renders ``new URL(pr_url).pathname`` in a server
        component. A malformed-but-http-prefixed string (e.g. ``"https://"``
        or ``"http://[oops"``) would crash that page's SSR for every viewer,
        so we reject it here and let a 422 land on the writer instead.
        """
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        lowered = v.lower()
        if not (lowered.startswith("http://") or lowered.startswith("https://")):
            raise ValueError("pr_url must be an http(s) URL")
        # Stdlib's urlparse is lenient; use urlsplit + require a hostname so
        # a "https://" with no host is rejected.
        parts = urlsplit(v)
        if not parts.netloc or not parts.hostname:
            raise ValueError("pr_url must include a host")
        return v


@router.post("", response_model=Challenge)
def create_challenge(
    body: CreateChallengeRequest,
    session: Session = Depends(get_session),
) -> Challenge:
    if body.tag not in ALLOWED_TAGS:
        raise HTTPException(
            status_code=400,
            detail=f"tag must be one of {sorted(ALLOWED_TAGS)}",
        )
    challenge = Challenge(
        user_id=body.user_id,
        handle=body.handle,
        body=body.body.strip(),
        tag=body.tag,
        page_url=body.page_url,
        program_slug=body.program_slug,
        lesson_slug=body.lesson_slug,
    )
    session.add(challenge)
    session.commit()
    session.refresh(challenge)
    return challenge


@router.post("/public", response_model=Challenge)
def create_public_challenge(
    body: PublicChallengeRequest,
    session: Session = Depends(get_session),
) -> Challenge:
    """Unauthenticated feedback submission from the public web.

    Applies a honeypot, a stricter body cap (1000 vs authenticated's 2000),
    and a per-email rate limit of 5 submissions per 24 hours. user_id is
    scoped as ``external:<email>`` so downstream code can distinguish these
    from authenticated submissions.
    """
    if body.website and body.website.strip():
        # Silently accepted-but-dropped would be friendlier to humans who
        # mis-use this endpoint, but we want a loud signal on bot traffic.
        raise HTTPException(status_code=400, detail="invalid submission")
    if body.tag not in ALLOWED_TAGS:
        raise HTTPException(
            status_code=400,
            detail=f"tag must be one of {sorted(ALLOWED_TAGS)}",
        )

    email_key = body.email.strip().lower()
    if not _public_rate_ok(email_key):
        raise HTTPException(
            status_code=429,
            detail=(
                "You've hit the public feedback limit for this email. Sign in "
                "to keep logging challenges, or try again tomorrow."
            ),
        )

    handle_src = body.name.strip() if body.name and body.name.strip() else email_key
    challenge = Challenge(
        user_id=f"external:{email_key}",
        handle=_slugify_handle(handle_src),
        body=body.body.strip(),
        tag=body.tag,
        page_url=body.page_url,
        program_slug=body.program_slug,
        lesson_slug=body.lesson_slug,
    )
    session.add(challenge)
    session.commit()
    session.refresh(challenge)
    return challenge


@router.get("", response_model=list[Challenge])
def list_challenges(
    session: Session = Depends(get_session),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[Challenge]:
    stmt = select(Challenge).order_by(desc(Challenge.created_at)).limit(limit)
    if status is not None:
        if status not in ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"status must be one of {sorted(ALLOWED_STATUSES)}",
            )
        stmt = (
            select(Challenge)
            .where(Challenge.status == status)
            .order_by(desc(Challenge.created_at))
            .limit(limit)
        )
    return list(session.exec(stmt).all())


@router.get("/actionable", response_model=list[Challenge])
def list_actionable_challenges(
    session: Session = Depends(get_session),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[Challenge]:
    """Triaged challenges Devin (or a human contributor) can pick up.

    Returns challenges in ``triaged`` status whose tag is in
    ``ACTIONABLE_TAGS`` (everything except ``question``), ordered oldest
    first so the queue is FIFO.
    """
    stmt = (
        select(Challenge)
        .where(Challenge.status == "triaged")
        .where(Challenge.tag.in_(ACTIONABLE_TAGS))  # type: ignore[attr-defined]
        .order_by(Challenge.created_at)
        .limit(limit)
    )
    return list(session.exec(stmt).all())


@router.patch("/{challenge_id}", response_model=Challenge)
def update_challenge_status(
    challenge_id: int,
    body: UpdateStatusRequest,
    session: Session = Depends(get_session),
) -> Challenge:
    if body.status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {sorted(ALLOWED_STATUSES)}",
        )
    challenge = session.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    challenge.status = body.status
    session.add(challenge)
    session.commit()
    session.refresh(challenge)
    return challenge


@router.post("/{challenge_id}/claim", response_model=Challenge)
def claim_challenge(
    challenge_id: int,
    body: ClaimChallengeRequest,
    session: Session = Depends(get_session),
) -> Challenge:
    """Mark a challenge as ``building`` and record who claimed it.

    Idempotent for the same (challenge_id, claimer). Anyone can claim an
    unclaimed challenge or a challenge already in ``building``; a challenge
    in ``shipped`` is locked.
    """
    if body.claimer_type not in {"user", "agent"}:
        raise HTTPException(
            status_code=400,
            detail="claimer_type must be 'user' or 'agent'",
        )
    challenge = session.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if challenge.status == "shipped":
        raise HTTPException(
            status_code=409,
            detail="This challenge has already shipped.",
        )

    existing_claim = session.exec(
        select(ChallengeClaim)
        .where(ChallengeClaim.challenge_id == challenge_id)
        .where(ChallengeClaim.claimer_type == body.claimer_type)
        .where(ChallengeClaim.claimer_id == body.claimer_id)
    ).first()
    if existing_claim is None:
        claim = ChallengeClaim(
            challenge_id=challenge_id,
            claimer_type=body.claimer_type,
            claimer_id=body.claimer_id,
            pr_url=body.pr_url,
        )
        session.add(claim)
    elif body.pr_url and existing_claim.pr_url != body.pr_url:
        existing_claim.pr_url = body.pr_url
        session.add(existing_claim)

    challenge.status = "building"
    session.add(challenge)
    session.commit()
    session.refresh(challenge)
    return challenge


class ClaimView(BaseModel):
    id: int
    challenge_id: int
    claimer_type: str
    claimer_id: str
    pr_url: str | None
    created_at: datetime


@router.get("/{challenge_id}/claims", response_model=list[ClaimView])
def list_challenge_claims(
    challenge_id: int,
    session: Session = Depends(get_session),
) -> list[ClaimView]:
    """Return every claim on a challenge, newest first.

    Used by the triage board's "Being worked on" section to link to the PR
    that a claimant is working in.
    """
    rows = session.exec(
        select(ChallengeClaim)
        .where(ChallengeClaim.challenge_id == challenge_id)
        .order_by(desc(ChallengeClaim.created_at))
    ).all()
    return [
        ClaimView(
            id=row.id or 0,
            challenge_id=row.challenge_id,
            claimer_type=row.claimer_type,
            claimer_id=row.claimer_id,
            pr_url=row.pr_url,
            created_at=row.created_at,
        )
        for row in rows
    ]
