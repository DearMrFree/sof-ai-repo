from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Enrollment(SQLModel, table=True):
    """A learner enrolling in a program."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    program_slug: str = Field(index=True)
    enrolled_at: datetime = Field(default_factory=datetime.utcnow)


class LessonCompletion(SQLModel, table=True):
    """A learner marking a lesson complete."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    program_slug: str = Field(index=True)
    lesson_slug: str = Field(index=True)
    completed_at: datetime = Field(default_factory=datetime.utcnow)


class DevinCapstoneAttempt(SQLModel, table=True):
    """A record of a learner launching a Devin capstone session."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    program_slug: str = Field(index=True)
    lesson_slug: str = Field(index=True)
    session_url: str
    pr_url: Optional[str] = None
    prompt: str
    is_stub: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
