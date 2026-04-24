"""Invitations — hand out sof.ai access to external humans.

A principal or instructor creates an invitation with POST /invitations. That
writes a row with a cryptographically random ``token`` and returns the full
accept URL — the caller is responsible for actually getting it to the
invitee (email, LinkedIn DM, a printed card, whatever). The recipient opens
``/invite/<token>`` on the frontend, which reads the invite via
``GET /invitations/accept/<token>`` and lets them finish joining.

Safeguards:
  - Invitations expire (default 7 days). Expired rows stay for audit.
  - Max 20 pending invitations per inviter.
  - Rate limit of 10 new invitations per inviter per 24 hours.
  - A given email can have at most one *pending* invitation at a time.
  - Tokens are ``secrets.token_urlsafe(32)`` — ~256 bits of entropy.

Principal/instructor role check is done against the inviter_id — any id in
``PRIVILEGED_USER_IDS`` may invite. v2 will plug this into the person role
registry once people also live in the DB. For now the registry is a static
``web/src/lib/people.ts`` list and the principal is Dr. Freedom Cheteni.
"""

from __future__ import annotations

import re
import secrets as pysecrets
import threading
from collections import deque
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session, desc, select

from ..db import get_session
from ..models import Invitation

router = APIRouter(prefix="/invitations", tags=["invitations"])

ALLOWED_ROLES = {"contributor", "learner", "reviewer", "mentor"}
ALLOWED_STATUSES = {"pending", "accepted", "expired", "revoked"}

DEFAULT_EXPIRY = timedelta(days=7)
MAX_PENDING_PER_INVITER = 20
RATE_LIMIT_PER_DAY = 10
RATE_LIMIT_WINDOW = timedelta(hours=24)

# Inviter user_ids allowed to call POST /invitations. v1 list — we keep it
# tiny and explicit. The Next.js proxy is responsible for mapping the
# session user id into one of these (or rejecting).
PRIVILEGED_USER_IDS: set[str] = {
    # Dr. Freedom Cheteni's stable id (email-provider form).
    "email:freedom@thevrschool.org",
    # Also accept the vanity-handle form in case the frontend sends it.
    "freedom",
    # "system" is the identity used by the seed-an-invitation-on-startup
    # path so we don't blow up when the DB is first initialised.
    "system",
}

_rate_lock = threading.Lock()
_rate: dict[str, deque[datetime]] = {}

# Guard against concurrent accepts of the same token beating each other.
_accept_lock = threading.Lock()


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _rate_would_allow(inviter_id: str) -> bool:
    """Non-mutating check: is this inviter currently under the 24h limit?

    Separate from the record call so we can reject idempotent no-ops (the
    dupe/over-pending paths) without consuming a rate-limit slot — and
    more importantly so a double-submit from the UI doesn't chew through
    the daily budget on replayed requests.
    """
    now = _utcnow()
    cutoff = now - RATE_LIMIT_WINDOW
    with _rate_lock:
        q = _rate.setdefault(inviter_id, deque())
        while q and q[0] < cutoff:
            q.popleft()
        return len(q) < RATE_LIMIT_PER_DAY


def _rate_record(inviter_id: str) -> None:
    """Record a rate-limit hit. Call AFTER we know an invitation will be
    minted (i.e. after the dupe + pending-count checks have passed)."""
    now = _utcnow()
    with _rate_lock:
        _rate.setdefault(inviter_id, deque()).append(now)


def _normalize_email(raw: str) -> str:
    return raw.strip().lower()


class CreateInvitationRequest(BaseModel):
    inviter_id: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    name: str | None = Field(default=None, max_length=120)
    role: str = Field(default="contributor", max_length=32)
    program_slug: str | None = Field(default=None, max_length=120)
    message: str | None = Field(default=None, max_length=1000)


class UpdateInvitationRequest(BaseModel):
    status: str = Field(..., min_length=1, max_length=20)


class AcceptInvitationRequest(BaseModel):
    accepted_user_id: str | None = Field(default=None, max_length=120)


def _to_aware(dt: datetime | None) -> datetime | None:
    """Return ``dt`` as a UTC-aware datetime.

    SQLite drops tzinfo on round-trip, so a freshly-refreshed Invitation
    row may have naive ``expires_at`` even though we wrote it aware.
    Comparing naive vs aware datetimes raises TypeError — normalize here
    so downstream comparisons are always apples-to-apples.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def _maybe_expire_inplace(row: Invitation) -> Invitation:
    """If the invite is past its expires_at, flip status to 'expired'.

    The caller is responsible for persisting the change if they want it.
    """
    expires_at = _to_aware(row.expires_at)
    if (
        row.status == "pending"
        and expires_at is not None
        and expires_at < _utcnow()
    ):
        row.status = "expired"
    return row


@router.post("", response_model=Invitation)
def create_invitation(
    body: CreateInvitationRequest,
    session: Session = Depends(get_session),
) -> Invitation:
    if body.inviter_id not in PRIVILEGED_USER_IDS:
        raise HTTPException(
            status_code=403,
            detail="Only principals or instructors can create invitations.",
        )
    if body.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"role must be one of {sorted(ALLOWED_ROLES)}",
        )
    # Peek at the rate limit up front so a clearly-over-budget caller gets
    # a fast 429 before we touch the DB. We do NOT consume the slot here —
    # the actual record happens right before commit, so idempotent no-ops
    # (returning an existing dupe) don't eat the budget.
    if not _rate_would_allow(body.inviter_id):
        raise HTTPException(
            status_code=429,
            detail="Invitation rate limit hit. Try again tomorrow.",
        )

    email = _normalize_email(body.email)

    pending_count = len(
        session.exec(
            select(Invitation)
            .where(Invitation.inviter_id == body.inviter_id)
            .where(Invitation.status == "pending")
        ).all()
    )
    if pending_count >= MAX_PENDING_PER_INVITER:
        raise HTTPException(
            status_code=409,
            detail=(
                f"You already have {MAX_PENDING_PER_INVITER} pending "
                "invitations. Revoke some before sending more."
            ),
        )

    dupe = session.exec(
        select(Invitation)
        .where(Invitation.email == email)
        .where(Invitation.status == "pending")
    ).first()
    if dupe is not None:
        # Return the existing pending invite rather than minting a new one —
        # callers that re-run the seed get the stable token back. Crucially,
        # we do not record a rate-limit hit here: this path creates nothing.
        _maybe_expire_inplace(dupe)
        if dupe.status == "pending":
            return dupe
        # Fell through to expired — allow creating a fresh one.
        session.add(dupe)

    # At this point we're definitely minting a new invitation — record the
    # rate-limit hit now so the 24h budget only counts real writes.
    _rate_record(body.inviter_id)

    invitation = Invitation(
        inviter_id=body.inviter_id,
        email=email,
        name=body.name.strip() if body.name else None,
        role=body.role,
        program_slug=body.program_slug,
        message=body.message.strip() if body.message else None,
        status="pending",
        token=pysecrets.token_urlsafe(32),
        expires_at=_utcnow() + DEFAULT_EXPIRY,
    )
    session.add(invitation)
    session.commit()
    session.refresh(invitation)
    return invitation


@router.get("", response_model=list[Invitation])
def list_invitations(
    session: Session = Depends(get_session),
    inviter_id: str | None = Query(default=None),
    email: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[Invitation]:
    if status is not None and status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {sorted(ALLOWED_STATUSES)}",
        )
    stmt = select(Invitation).order_by(desc(Invitation.created_at)).limit(limit)
    if inviter_id is not None:
        stmt = stmt.where(Invitation.inviter_id == inviter_id)
    if email is not None:
        stmt = stmt.where(Invitation.email == _normalize_email(email))
    if status is not None:
        stmt = stmt.where(Invitation.status == status)
    rows = list(session.exec(stmt).all())
    # Lazily mark expired rows so the returned list reflects current reality.
    dirty = False
    for row in rows:
        before = row.status
        _maybe_expire_inplace(row)
        if row.status != before:
            session.add(row)
            dirty = True
    if dirty:
        session.commit()
    # If the caller filtered by status, drop rows whose status changed
    # after lazy expiry so the response honours the requested filter —
    # e.g. `?status=pending` must not return rows we just flipped to
    # 'expired' a few lines above.
    if status is not None:
        rows = [r for r in rows if r.status == status]
    return rows


_TOKEN_SAFE_RE = re.compile(r"^[A-Za-z0-9_\-]{16,200}$")


@router.get("/accept/{token}", response_model=Invitation)
def get_invitation_by_token(
    token: str,
    session: Session = Depends(get_session),
) -> Invitation:
    """Public lookup of an invite by token — for the /invite/[token] page."""
    if not _TOKEN_SAFE_RE.match(token):
        raise HTTPException(status_code=404, detail="Invitation not found.")
    row = session.exec(
        select(Invitation).where(Invitation.token == token)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Invitation not found.")
    before = row.status
    _maybe_expire_inplace(row)
    if row.status != before:
        session.add(row)
        session.commit()
        session.refresh(row)
    return row


@router.post("/accept/{token}", response_model=Invitation)
def accept_invitation(
    token: str,
    body: AcceptInvitationRequest,
    session: Session = Depends(get_session),
) -> Invitation:
    """Mark an invite as accepted.

    Does NOT create a user account — account creation is handled by the
    frontend's NextAuth flow. The ``accepted_user_id`` column just records
    who (if anyone) claimed the invite so the inviter can audit acceptance.
    """
    if not _TOKEN_SAFE_RE.match(token):
        raise HTTPException(status_code=404, detail="Invitation not found.")
    with _accept_lock:
        row = session.exec(
            select(Invitation).where(Invitation.token == token)
        ).first()
        if row is None:
            raise HTTPException(status_code=404, detail="Invitation not found.")
        _maybe_expire_inplace(row)
        if row.status == "expired":
            raise HTTPException(
                status_code=410,
                detail="This invitation has expired.",
            )
        if row.status == "revoked":
            raise HTTPException(
                status_code=410,
                detail="This invitation has been revoked.",
            )
        if row.status == "accepted":
            # Idempotent — accepting twice is a no-op.
            return row
        row.status = "accepted"
        row.accepted_at = _utcnow()
        row.accepted_user_id = body.accepted_user_id
        session.add(row)
        session.commit()
        session.refresh(row)
        return row


@router.patch("/{invitation_id}", response_model=Invitation)
def update_invitation(
    invitation_id: int,
    body: UpdateInvitationRequest,
    session: Session = Depends(get_session),
) -> Invitation:
    """Revoke or otherwise update an invitation's status.

    In practice only ``revoked`` is a valid transition here — accepted /
    expired are state the system owns.
    """
    if body.status not in {"revoked"}:
        raise HTTPException(
            status_code=400,
            detail="status must be 'revoked'",
        )
    row = session.get(Invitation, invitation_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Invitation not found.")
    if row.status == "accepted":
        raise HTTPException(
            status_code=409,
            detail="Already-accepted invitations cannot be revoked.",
        )
    row.status = body.status
    session.add(row)
    session.commit()
    session.refresh(row)
    return row
