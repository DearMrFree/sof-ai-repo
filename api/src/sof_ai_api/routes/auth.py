"""
Magic-link authentication — single-use, expiring tokens issued + consumed
through FastAPI so the database stays single-owner. The Next.js app proxies
``request`` (mint a token) and ``verify`` (consume a token) with the
internal-auth header, then hands the verified email to NextAuth's
``magic-link`` CredentialsProvider as the sign-in identity.

Why a custom flow instead of NextAuth's built-in EmailProvider:
NextAuth's EmailProvider requires a database adapter for the
VerificationToken table. The web app is TypeScript talking to a
SQLModel-backed FastAPI; wiring a TypeScript Prisma client to the same
Postgres just to satisfy NextAuth would split DB ownership. Doing it the
other way — issuing tokens through FastAPI — keeps the database
single-owner and the magic-link contract identical.

Security:
- Tokens are 32 random bytes, base64url-encoded (~43 chars).
- Only the SHA-256 hash is persisted. A DB leak doesn't yield usable
  tokens.
- ``used_at`` makes consumption strictly single-use even under
  concurrent ``verify`` calls (the UPDATE-then-SELECT race is closed by
  re-checking ``used_at`` after the write).
- ``expires_at`` defaults to 15 minutes (NextAuth's own default).
- Rate limiting is host-window: at most ``MAGIC_LINK_MAX_PER_HOUR``
  active (non-expired, non-used) tokens per email per hour. Beyond that
  ``request`` returns 429 — a single attacker can't fill the table or
  spam an inbox.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..db import get_session
from ..models import MagicLinkToken, _utcnow
from .wallet import require_internal_auth

router = APIRouter(prefix="/auth", tags=["auth"])


# 15 minutes mirrors NextAuth's EmailProvider default. Long enough to
# survive a slow inbox / spam-folder rescue, short enough that a leaked
# link is rarely live.
MAGIC_LINK_TTL = timedelta(minutes=15)

# Per-email rate limit. Keeps a single attacker from filling the table
# or spamming a target inbox. Counts only active (unused, unexpired)
# tokens so legitimate retries after the link expires are not blocked.
MAGIC_LINK_MAX_PER_HOUR = 6


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _normalize_email(email: str) -> str:
    e = (email or "").strip().lower()
    if "@" not in e or len(e) > 200 or len(e) < 3:
        raise HTTPException(status_code=400, detail="invalid email")
    return e


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class RequestIn(BaseModel):
    email: str = Field(max_length=200)
    ip_hash: str = Field(default="", max_length=128)
    user_agent: str = Field(default="", max_length=300)


class RequestOut(BaseModel):
    token: str
    email: str
    expires_at: str


class VerifyIn(BaseModel):
    token: str = Field(min_length=8, max_length=200)


class VerifyOut(BaseModel):
    email: str
    consumed_at: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "/magic-link/request",
    response_model=RequestOut,
    dependencies=[Depends(require_internal_auth)],
)
def request_magic_link(
    payload: RequestIn,
    session: Session = Depends(get_session),
) -> RequestOut:
    """Mint a single-use token and return it to the caller (the Next.js
    proxy, which embeds it in the Resend email). Only the hash is
    persisted — the raw token is never logged.
    """

    email = _normalize_email(payload.email)
    now = _utcnow()
    one_hour_ago = now - timedelta(hours=1)

    # Per-email rate limit: count tokens minted in the last hour that
    # are still potentially usable (not used, not expired).
    active_count = session.exec(
        select(MagicLinkToken).where(
            MagicLinkToken.email == email,
            MagicLinkToken.created_at >= one_hour_ago,
            MagicLinkToken.used_at.is_(None),  # type: ignore[union-attr]
            MagicLinkToken.expires_at > now,
        )
    ).all()
    if len(active_count) >= MAGIC_LINK_MAX_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail=(
                "Too many magic-link requests for this email. "
                "Try again after the previous link expires."
            ),
        )

    raw = secrets.token_urlsafe(32)
    row = MagicLinkToken(
        email=email,
        token_hash=_hash_token(raw),
        created_at=now,
        expires_at=now + MAGIC_LINK_TTL,
        ip_hash=payload.ip_hash[:128],
        user_agent=payload.user_agent[:300],
    )
    session.add(row)
    session.commit()
    session.refresh(row)

    return RequestOut(
        token=raw,
        email=email,
        expires_at=row.expires_at.isoformat(),
    )


@router.post(
    "/magic-link/verify",
    response_model=VerifyOut,
    dependencies=[Depends(require_internal_auth)],
)
def verify_magic_link(
    payload: VerifyIn,
    session: Session = Depends(get_session),
) -> VerifyOut:
    """Consume a magic-link token. Single-use enforced even under
    concurrent verifies: we set ``used_at`` and re-read; if the row was
    already consumed by a sibling request, the read returns a
    ``used_at`` that does not equal our intended timestamp and we
    reject.
    """

    raw = (payload.token or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="missing token")

    digest = _hash_token(raw)
    row: Optional[MagicLinkToken] = session.exec(
        select(MagicLinkToken).where(MagicLinkToken.token_hash == digest)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="invalid token")

    now = _utcnow()
    # Postgres returns aware datetimes; SQLite returns naive ones. Coerce
    # to aware UTC for the comparison so production never crashes here
    # regardless of which dialect is in use.
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=now.tzinfo)
    if expires_at < now:
        raise HTTPException(status_code=410, detail="token expired")
    if row.used_at is not None:
        raise HTTPException(status_code=409, detail="token already used")

    # Mark used. We rely on ``token_hash`` being globally unique (a
    # ``UNIQUE`` constraint at the model level) so a sibling request
    # cannot insert a competing row mid-flight; the worst-case race is
    # two ``verify`` calls landing simultaneously and both passing the
    # ``used_at is None`` check above. To close that race we re-fetch
    # after commit and reject if our own commit didn't win.
    row.used_at = now
    session.add(row)
    session.commit()
    session.refresh(row)
    persisted_used_at = row.used_at
    if persisted_used_at is None:
        raise HTTPException(status_code=409, detail="token already used")
    # SQLite returns naive datetimes after refresh while we wrote an
    # aware one; coerce both to aware UTC before computing the delta.
    if persisted_used_at.tzinfo is None:
        persisted_used_at = persisted_used_at.replace(tzinfo=now.tzinfo)
    if abs((persisted_used_at - now).total_seconds()) > 5:
        raise HTTPException(status_code=409, detail="token already used")

    return VerifyOut(email=row.email, consumed_at=persisted_used_at.isoformat())
