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


class Journal(SQLModel, table=True):
    """A scholarly journal hosted on sof.ai (Journalism School of AI).

    Designed to mirror Open Journal Systems' (OJS) data model — an open-source
    scholarly publishing platform by PKP at SFU (https://pkp.sfu.ca/ojs) —
    so we can federate 1:1 with a real OJS instance in a later phase. Slug
    is canonical (used in URLs); editor_in_chief is the founding owner who
    earns the `found_journal` Educoin® payout.
    """

    __table_args__ = (
        UniqueConstraint("slug", name="uq_journal_slug"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    slug: str = Field(index=True, max_length=80)
    title: str = Field(max_length=200)
    description: str = ""
    topic_tags: str = ""  # comma-separated, keep this simple for v1
    # OJS calls this "context" — on sof.ai a journal can belong to an agent
    # school (e.g. journalism), but the owner is always a user or agent.
    editor_in_chief_type: str  # "user" | "agent"
    editor_in_chief_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=_utcnow)


class JournalArticle(SQLModel, table=True):
    """A paper submitted (and possibly published) to a journal.

    Status flow mirrors OJS: draft → submitted → under_review → accepted
    → published | rejected. Authors is a JSON-ish comma-separated list of
    owner keys ("user:uuid" / "agent:devin") so humans and agents are
    first-class co-authors.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    journal_slug: str = Field(index=True)
    title: str = Field(max_length=300)
    abstract: str = ""
    body: str = ""  # v1: plaintext/markdown; OJS uses a PDF/HTML galley
    # Primary author — the submitter who earns the submit payout.
    submitter_type: str  # "user" | "agent"
    submitter_id: str = Field(index=True)
    # Comma-separated additional authors, "user:abc,agent:devin". Optional.
    coauthors: str = ""
    status: str = Field(
        default="submitted", index=True
    )  # draft | submitted | under_review | accepted | published | rejected
    published_issue_id: Optional[int] = Field(default=None, index=True)
    submitted_at: datetime = Field(default_factory=_utcnow)
    published_at: Optional[datetime] = None


class JournalArticleRevision(SQLModel, table=True):
    """A historical snapshot of an article's body.

    Articles on sof.ai are living documents — authors revise in response to
    peer reviews, new PRs shipped against the underlying claim, etc. Every
    revision is preserved so editors can diff them over time without losing
    earlier versions. Revision 1 is the submission; subsequent revisions
    are numbered sequentially per article.
    """

    __table_args__ = (
        UniqueConstraint(
            "article_id", "revision_no", name="uq_revision_article_number"
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    article_id: int = Field(index=True)
    revision_no: int
    # Who made the revision (the author, an editor, or an agent helper).
    revised_by_type: str  # "user" | "agent"
    revised_by_id: str = Field(index=True)
    changelog: str = ""
    body: str  # full snapshot (not a diff — small table, cheap storage)
    created_at: datetime = Field(default_factory=_utcnow)


class JournalPeerReview(SQLModel, table=True):
    """A single peer-review round on an article.

    OJS supports anonymous / double-blind reviews; v1 keeps it transparent —
    the reviewer identity is recorded. We require (article_id, reviewer)
    to be unique so a reviewer can't double-claim the review payout.
    """

    __table_args__ = (
        UniqueConstraint(
            "article_id",
            "reviewer_type",
            "reviewer_id",
            name="uq_peer_review_reviewer",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    article_id: int = Field(index=True)
    reviewer_type: str  # "user" | "agent"
    reviewer_id: str = Field(index=True)
    recommendation: str  # "accept" | "minor_revisions" | "major_revisions" | "reject"
    comments: str = ""
    created_at: datetime = Field(default_factory=_utcnow)


class JournalIssue(SQLModel, table=True):
    """A published issue — a bundle of accepted articles, released together.

    Publishing an issue flips its articles from ``accepted`` → ``published``
    and pays the editor-in-chief the ``issue_published`` payout.
    """

    __table_args__ = (
        UniqueConstraint(
            "journal_slug", "volume", "number", name="uq_issue_volume_number"
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    journal_slug: str = Field(index=True)
    volume: int
    number: int
    title: str = ""
    description: str = ""
    published_at: datetime = Field(default_factory=_utcnow)


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
