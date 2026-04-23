from datetime import UTC, datetime
from typing import Optional

from sqlalchemy import Index, UniqueConstraint, text
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


class Challenge(SQLModel, table=True):
    """A user-reported challenge / friction / feedback item.

    These are the `/feedback` submissions — the feedback loop that informs
    design and curriculum changes. Status moves through new → triaged →
    building → shipped. No unique constraint — duplicates are allowed; a
    user might report the same thing from different pages.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    handle: str = Field(index=True)
    body: str
    tag: str = Field(index=True)  # "confusing" | "broken" | "missing" | "question" | "idea"
    page_url: Optional[str] = None
    program_slug: Optional[str] = Field(default=None, index=True)
    lesson_slug: Optional[str] = Field(default=None, index=True)
    status: str = Field(default="new", index=True)  # new | triaged | building | shipped
    created_at: datetime = Field(default_factory=_utcnow)


class Wallet(SQLModel, table=True):
    """An Educoin® wallet for a human learner or an agent.

    Educoin® is a registered service mark of InventXR LLC (USPTO Reg. No.
    5,935,271, Class 41). This is the canonical ledger for the in-app economy:
    every earn/spend/transfer lands here. Balance is a cached integer updated
    inside the same DB transaction that inserts the Transaction row — so the
    invariant `wallet.balance == sum(tx.amount where tx.owner == wallet.owner)`
    holds after every committed mutation.

    owner_type is "user" or "agent"; owner_id is the stable user_id (uuid) for
    humans and the agent_id ("devin", "claude", ...) for agents.
    """

    __table_args__ = (
        UniqueConstraint("owner_type", "owner_id", name="uq_wallet_owner"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_type: str = Field(index=True)  # "user" | "agent"
    owner_id: str = Field(index=True)
    balance: int = Field(default=0)
    lifetime_earned: int = Field(default=0)
    lifetime_sent: int = Field(default=0)
    lifetime_received: int = Field(default=0)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class EducoinTransaction(SQLModel, table=True):
    """A single ledger entry for Educoin®.

    Append-only. Every mutation writes a row here; balance deltas are applied
    to Wallet inside the same transaction. For transfers we write two rows
    (one "transfer_out" for sender, one "transfer_in" for recipient) sharing a
    correlation_id so auditors can pair them.

    Kinds:
      earn          — system credited the owner (lesson-complete, course-published, etc.)
      spend         — owner spent on marketplace item
      transfer_out  — owner sent to counterparty
      transfer_in   — owner received from counterparty
      award         — discretionary admin grant
      adjustment    — admin correction (rare, audited)

    The ``ux_earn_correlation`` partial unique index backs up the
    application-level ``_has_earn()`` dedupe check in ``ledger.credit()``.
    Without it, two concurrent "earn" credits with the same correlation_id
    (e.g. enrolling into two programs simultaneously → double signup bonus)
    could both pass the SELECT check and both insert. The index makes the
    DB reject the second insert; ``credit()`` catches the IntegrityError
    and returns ``None`` (the same no-op shape as the happy-path dedupe).
    """

    __table_args__ = (
        Index(
            "ux_earn_correlation",
            "owner_type",
            "owner_id",
            "correlation_id",
            unique=True,
            sqlite_where=text("kind = 'earn' AND correlation_id IS NOT NULL"),
            postgresql_where=text(
                "kind = 'earn' AND correlation_id IS NOT NULL"
            ),
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    # Ledger side.
    owner_type: str = Field(index=True)
    owner_id: str = Field(index=True)
    # Positive amount for earn/transfer_in/award, negative for spend/transfer_out.
    amount: int
    kind: str = Field(index=True)
    memo: str = ""
    # Counterparty fields are set on transfers; empty on earn/spend/award.
    counterparty_type: Optional[str] = None
    counterparty_id: Optional[str] = None
    # Correlation id — e.g. "lesson:<program>:<slug>", "course:<slug>",
    # "transfer:<uuid>". Helps dedupe earn rules and pair transfer legs.
    correlation_id: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=_utcnow)


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
