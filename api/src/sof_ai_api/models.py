from datetime import UTC, datetime
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    """Timezone-aware UTC now — replaces deprecated datetime.utcnow()."""
    return datetime.now(UTC)


class Enrollment(SQLModel, table=True):
    """A learner enrolling in a program.

    (user_id, program_slug) is the natural key. The unique constraint backs up
    the select-then-insert idempotency check in the enroll route, which alone
    has a TOCTOU race under concurrent requests.
    """

    __table_args__ = (
        UniqueConstraint("user_id", "program_slug", name="uq_enrollment"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    program_slug: str = Field(index=True)
    enrolled_at: datetime = Field(default_factory=_utcnow)


class LessonCompletion(SQLModel, table=True):
    """A learner marking a lesson complete.

    (user_id, program_slug, lesson_slug) is the natural key.
    """

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "program_slug",
            "lesson_slug",
            name="uq_lesson_completion",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    program_slug: str = Field(index=True)
    lesson_slug: str = Field(index=True)
    completed_at: datetime = Field(default_factory=_utcnow)


class DevinCapstoneAttempt(SQLModel, table=True):
    """A record of a learner launching a Devin capstone session.

    No unique constraint — multiple attempts per lesson are allowed (retries,
    multiple sessions) and we want to preserve history.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    program_slug: str = Field(index=True)
    lesson_slug: str = Field(index=True)
    session_url: str
    pr_url: Optional[str] = None
    prompt: str
    is_stub: bool = False
    created_at: datetime = Field(default_factory=_utcnow)
