"""
Seed: the first invitation — Brandon Bayquen.

Idempotent bootstrap. If there is already a pending / accepted invitation
for Brandon's email this is a no-op. Otherwise it creates a fresh pending
invite with a fresh random token and prints the accept URL to stdout so the
operator can paste it into a LinkedIn DM (email sending is not wired yet).

Why Brandon:
  - He left the first honest external feedback on sof.ai V1 ("looks like
    the usual AI slop") on LinkedIn.
  - The invitation system exists partly because of that feedback — this
    is the system eating its own dogfood.
"""

from __future__ import annotations

import os
import secrets as pysecrets
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, select

from .models import Invitation

BRANDON_EMAIL = "brandonbayquen@gmail.com"
BRANDON_NAME = "Brandon Bayquen"
INVITE_EXPIRY = timedelta(days=14)
SYSTEM_INVITER_ID = "system"

INVITE_MESSAGE = (
    "Hey Brandon — thanks for the honest feedback on V1. We'd love your "
    "eye on the UI/UX as we iterate. This is sof.ai's first human-agent "
    "collaboration invite. Jump in, log challenges, and help shape what "
    "ships next."
)


def _base_url() -> str:
    """Best-effort base URL for the accept link.

    Checks ``SOF_AI_WEB_BASE_URL`` first, then falls back to the production
    domain. We never hard-code localhost here — the link is meant to be
    shareable via a DM, not a dev-only helper.
    """
    return os.environ.get("SOF_AI_WEB_BASE_URL", "https://sof.ai").rstrip("/")


def seed(session: Session) -> Invitation | None:
    """Mint Brandon's invitation if one doesn't already exist.

    Returns the new invitation on first run, ``None`` otherwise.
    """
    existing = session.exec(
        select(Invitation)
        .where(Invitation.email == BRANDON_EMAIL)
        .where(Invitation.status.in_(("pending", "accepted")))  # type: ignore[attr-defined]
    ).first()
    if existing is not None:
        return None

    invitation = Invitation(
        inviter_id=SYSTEM_INVITER_ID,
        email=BRANDON_EMAIL,
        name=BRANDON_NAME,
        role="contributor",
        program_slug="software-engineer",
        message=INVITE_MESSAGE,
        status="pending",
        token=pysecrets.token_urlsafe(32),
        expires_at=datetime.now(UTC) + INVITE_EXPIRY,
    )
    session.add(invitation)
    session.commit()
    session.refresh(invitation)

    # Log the accept link so the operator can grab it out of the Fly logs
    # and paste into a LinkedIn DM. This is intentionally "print, don't
    # email" until SMTP / a transactional mail provider is wired up.
    accept_url = f"{_base_url()}/invite/{invitation.token}"
    print(
        f"[sof.ai invite] Brandon's accept link (status=pending, "
        f"expires={invitation.expires_at}): {accept_url}",
        flush=True,
    )
    return invitation
