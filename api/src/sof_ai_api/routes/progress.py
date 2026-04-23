from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..db import get_session
from ..models import Enrollment, LessonCompletion

router = APIRouter(prefix="/progress", tags=["progress"])


class EnrollRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    program_slug: str = Field(..., min_length=1)


class CompleteRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    program_slug: str = Field(..., min_length=1)
    lesson_slug: str = Field(..., min_length=1)


class ProgressSummary(BaseModel):
    user_id: str
    program_slug: str
    enrolled_at: datetime | None
    completed_lesson_slugs: list[str]


@router.post("/enroll", response_model=Enrollment)
def enroll(
    body: EnrollRequest,
    session: Session = Depends(get_session),
) -> Enrollment:
    existing = session.exec(
        select(Enrollment).where(
            Enrollment.user_id == body.user_id,
            Enrollment.program_slug == body.program_slug,
        )
    ).first()
    if existing:
        return existing
    e = Enrollment(user_id=body.user_id, program_slug=body.program_slug)
    session.add(e)
    session.commit()
    session.refresh(e)
    return e


@router.post("/complete", response_model=LessonCompletion)
def complete(
    body: CompleteRequest,
    session: Session = Depends(get_session),
) -> LessonCompletion:
    existing = session.exec(
        select(LessonCompletion).where(
            LessonCompletion.user_id == body.user_id,
            LessonCompletion.program_slug == body.program_slug,
            LessonCompletion.lesson_slug == body.lesson_slug,
        )
    ).first()
    if existing:
        return existing
    c = LessonCompletion(
        user_id=body.user_id,
        program_slug=body.program_slug,
        lesson_slug=body.lesson_slug,
    )
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


@router.get("/{user_id}/{program_slug}", response_model=ProgressSummary)
def summary(
    user_id: str,
    program_slug: str,
    session: Session = Depends(get_session),
) -> ProgressSummary:
    enrollment = session.exec(
        select(Enrollment).where(
            Enrollment.user_id == user_id,
            Enrollment.program_slug == program_slug,
        )
    ).first()
    completions = session.exec(
        select(LessonCompletion).where(
            LessonCompletion.user_id == user_id,
            LessonCompletion.program_slug == program_slug,
        )
    ).all()
    return ProgressSummary(
        user_id=user_id,
        program_slug=program_slug,
        enrolled_at=enrollment.enrolled_at if enrollment else None,
        completed_lesson_slugs=[c.lesson_slug for c in completions],
    )
