"""Challenges — the user-facing feedback loop.

Every submission captured here flows back into curriculum + app design.
The intent: a student taking Devin's course should be able to log every
friction point in one click and watch it progress from "new" → "shipped".
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, desc, select

from ..db import get_session
from ..models import Challenge

router = APIRouter(prefix="/challenges", tags=["challenges"])

ALLOWED_TAGS = {"confusing", "broken", "missing", "question", "idea"}
ALLOWED_STATUSES = {"new", "triaged", "building", "shipped"}


class CreateChallengeRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=120)
    handle: str = Field(..., min_length=1, max_length=80)
    body: str = Field(..., min_length=3, max_length=2000)
    tag: str = Field(..., min_length=1, max_length=20)
    page_url: str | None = Field(default=None, max_length=500)
    lesson_slug: str | None = Field(default=None, max_length=120)


class UpdateStatusRequest(BaseModel):
    status: str = Field(..., min_length=1, max_length=20)


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
