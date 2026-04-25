"""
Seed: Brandon Bayquen's first public feedback challenge.

Idempotent bootstrap. Runs on application startup (from ``main.lifespan``)
and can be re-run safely any number of times — the insert is guarded by an
existence check keyed on Brandon's external user_id so warm restarts don't
duplicate the row.

The purpose is to make Brandon's honest LinkedIn feedback on sof.ai V1 — the
"looks like the usual AI slop" comment — visible on the public Challenges
triage board as the first real piece of external design feedback sof.ai has
received. It seeds the loop that Task 3's public /challenges/public endpoint
later widens to the general internet.
"""

from __future__ import annotations

from sqlmodel import Session, select

from .models import Challenge

BRANDON_USER_ID = "external:brandonbayquen@gmail.com"
BRANDON_HANDLE = "brandon-bayquen"

BRANDON_FEEDBACK_BODY = (
    "sof.ai's V1 website definitely needs work, from a technical POV, it "
    "currently looks like the usual 'AI slop' that most coding agents end up "
    "making. AI is still bad at getting a knack for design, but is way better "
    "at the backend side of software."
)


def seed(session: Session) -> Challenge | None:
    """Insert Brandon's feedback as the first public challenge if missing.

    Returns the inserted row on first run, ``None`` on subsequent runs.
    """
    existing = session.exec(
        select(Challenge).where(Challenge.user_id == BRANDON_USER_ID)
    ).first()
    if existing is not None:
        return None

    challenge = Challenge(
        user_id=BRANDON_USER_ID,
        handle=BRANDON_HANDLE,
        body=BRANDON_FEEDBACK_BODY,
        tag="idea",
        status="new",
    )
    session.add(challenge)
    session.commit()
    session.refresh(challenge)
    return challenge
