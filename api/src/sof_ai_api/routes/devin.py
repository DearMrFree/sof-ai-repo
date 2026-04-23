"""Devin capstone attempts — records of learners launching a Devin session.

The actual session creation happens in the Next.js frontend (so API keys stay
close to the user's browser and streaming works simply). This endpoint just
persists the attempt so we can show learners their history and drive grading.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session

from ..db import get_session
from ..models import DevinCapstoneAttempt

router = APIRouter(prefix="/devin", tags=["devin"])


class RecordAttempt(BaseModel):
    user_id: str = Field(..., min_length=1)
    program_slug: str = Field(..., min_length=1)
    lesson_slug: str = Field(..., min_length=1)
    session_url: str
    pr_url: str | None = None
    prompt: str
    is_stub: bool = False


@router.post("/attempts", response_model=DevinCapstoneAttempt)
def record(
    body: RecordAttempt,
    session: Session = Depends(get_session),
) -> DevinCapstoneAttempt:
    attempt = DevinCapstoneAttempt(**body.model_dump())
    session.add(attempt)
    session.commit()
    session.refresh(attempt)
    return attempt
