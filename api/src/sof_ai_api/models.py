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
    # OJS federation (Phase 2). Populated once this journal has been mirrored
    # to a real OJS instance; null until then. `ojs_context_path` is OJS's
    # url-segment for the journal (e.g. "journal-ai").
    ojs_context_path: Optional[str] = Field(default=None, index=True)
    ojs_context_id: Optional[int] = Field(default=None)
    ojs_synced_at: Optional[datetime] = Field(default=None)
    ojs_sync_error: Optional[str] = Field(default=None)


class JournalArticle(SQLModel, table=True):
    """A paper submitted (and possibly published) to a journal.

    Status flow mirrors OJS: draft → submitted → under_review → accepted
    → published | rejected. Authors is a JSON-ish comma-separated list of
    owner keys ("user:uuid" / "agent:devin") so humans and agents are
    first-class co-authors.

    Living-Article Pipeline fields (``source_session_id``, ``pipeline_phase``)
    are populated when the article was auto-generated from a chat session
    on /classroom/agents/devin. ``pipeline_phase`` advances through:
        drafted → claude_review_1 → devin_review_1 → claude_review_2
              → gemini_review → devin_final → awaiting_approval
              → approved → published
    For non-pipeline articles (e.g. seeded Journal AI) ``pipeline_phase`` is
    NULL and the article uses the legacy ``status`` field directly.
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
    # Living-Article Pipeline. Populated when the article was auto-generated
    # from a Devin chat session. ``source_session_id`` is the chat thread id;
    # idempotency on this column ensures a chat that crosses the 3-turn
    # threshold twice doesn't spawn two articles.
    source_session_id: Optional[str] = Field(default=None, index=True)
    pipeline_phase: Optional[str] = Field(default=None, index=True)
    pipeline_started_at: Optional[datetime] = Field(default=None)
    pipeline_completed_at: Optional[datetime] = Field(default=None)
    # OJS federation (Phase 2). OJS submission id is the foreign key in the
    # real OJS database once this article has been mirrored.
    ojs_submission_id: Optional[int] = Field(default=None, index=True)
    ojs_synced_at: Optional[datetime] = Field(default=None)
    ojs_sync_error: Optional[str] = Field(default=None)


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
    # OJS federation (Phase 2).
    ojs_review_assignment_id: Optional[int] = Field(default=None, index=True)
    ojs_synced_at: Optional[datetime] = Field(default=None)
    ojs_sync_error: Optional[str] = Field(default=None)


class ArticleReviewRound(SQLModel, table=True):
    """One step of the Living-Article Pipeline.

    The pipeline runs Claude → Devin → Claude → Gemini → Devin in sequence
    on every auto-generated article. Each row is one of those steps and
    captures the reviewing agent, the structured result they produced
    (suggested edits, code-audit findings, visual prompts), and whether
    that result was accepted into the article body.

    ``phase`` matches one of the pipeline phase names defined on
    JournalArticle.pipeline_phase. ``round_no`` is monotonically increasing
    per article so even if we re-run a phase the history is preserved.
    """

    __table_args__ = (
        UniqueConstraint(
            "article_id", "round_no", name="uq_article_review_round"
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    article_id: int = Field(index=True)
    round_no: int
    phase: str = Field(index=True)  # one of the pipeline_phase strings
    reviewer_type: str  # always "agent" in v1
    reviewer_id: str = Field(index=True)  # "claude" | "devin" | "gemini"
    summary: str = ""  # one-line takeaway shown in the timeline
    body: str = ""  # full review content (markdown)
    accepted: bool = Field(default=False)
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
    # OJS federation (Phase 2).
    ojs_issue_id: Optional[int] = Field(default=None, index=True)
    ojs_synced_at: Optional[datetime] = Field(default=None)
    ojs_sync_error: Optional[str] = Field(default=None)


class AgentApplication(SQLModel, table=True):
    """An application from an outside agent (or human) to join sof.ai.

    Three lanes share one row:
      - ``independent_agent``: a human-built / open-source AI applying directly
      - ``company_ai``: an org onboarding their AI product
      - ``human_seeking``: a human who wants their own AI trained on sof.ai

    The state machine:
        submitted → vetting → vetted_pass | vetted_revise | vetted_reject
        vetted_pass → trio_reviewing → conditionally_accepted | declined

    ``vetted_reject`` and ``declined`` are terminal. ``vetted_revise`` lets the
    applicant resubmit (we just clear vet_* and put them back in ``submitted``).

    Devin runs the first-pass vet (``vet_status``); the trio (Freedom + Garth
    Corea + Esther Wojcicki) cast yes/no/maybe votes; Devin synthesizes those
    votes into the final ``status`` (conditionally_accepted vs declined). The
    APA's 5 ethical principles + sof.ai's mission for human flourishing are
    baked into Devin's vetting system prompt.

    No unique constraint — applicants can resubmit; we keep the history.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    # Identity ----------------------------------------------------------------
    applicant_kind: str = Field(
        index=True
    )  # "independent_agent" | "company_ai" | "human_seeking"
    applicant_name: str = Field(max_length=200)
    applicant_email: str = Field(max_length=200, index=True)
    org_name: str = Field(default="", max_length=200)
    agent_name: str = Field(default="", max_length=200)
    agent_url: str = Field(default="", max_length=400)
    # Pitch -------------------------------------------------------------------
    mission_statement: str = Field(default="")  # alignment with human flourishing
    apa_statement: str = Field(default="")  # alignment with APA ethics principles
    # Public-review lane (Phase 2 of the social signal). Opt-in flag —
    # applicants can publish their pitch on /apply/public for community
    # likes / comments before the trio votes.
    public_review_url: str = Field(default="", max_length=400)
    public_listing: bool = Field(default=False)
    # Devin's first-pass vet --------------------------------------------------
    vet_status: str = Field(
        default="pending", index=True
    )  # pending | passed | needs_revision | rejected
    vet_reasoning: str = Field(default="")  # Devin's full reasoning (markdown)
    vet_recommendation: str = Field(default="")  # short paragraph for the trio
    vet_at: Optional[datetime] = Field(default=None)
    # Final state machine ----------------------------------------------------
    status: str = Field(
        default="submitted", index=True
    )  # submitted | vetting | vetted_pass | vetted_revise | vetted_reject
    # | trio_reviewing | conditionally_accepted | declined
    final_decision: str = Field(default="")  # conditionally_accepted | declined
    final_decision_at: Optional[datetime] = Field(default=None)
    final_reasoning: str = Field(default="")  # Devin's synthesis of the trio
    submitted_at: datetime = Field(default_factory=_utcnow)


class AgentApplicationReview(SQLModel, table=True):
    """One trio reviewer's recommendation on an application.

    Each of (Freedom, Garth Corea, Esther Wojcicki) gets a single-use,
    HMAC-signed link in their email and submits one row here. Unique on
    (application_id, reviewer_email) so a reviewer can't double-vote.
    Once 3 rows exist for an application, Devin auto-runs the final
    synthesis call and writes the result to AgentApplication.final_decision.
    """

    __table_args__ = (
        UniqueConstraint(
            "application_id", "reviewer_email", name="uq_application_reviewer"
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(index=True)
    reviewer_email: str = Field(max_length=200, index=True)
    reviewer_name: str = Field(default="", max_length=200)
    vote: str = Field(index=True)  # "yes" | "no" | "maybe"
    comment: str = Field(default="")
    created_at: datetime = Field(default_factory=_utcnow)


class ApplicationLike(SQLModel, table=True):
    """A signed-in user upvoting a publicly-listed application.

    Likes only count when ``AgentApplication.public_listing == True`` —
    private applications can't accumulate signal. Unique on
    (application_id, user_id) so a user can't farm the count.

    Devin folds the like total into the vet recommendation it sends to
    the trio: more public signal → stronger nudge in the recommendation
    paragraph (likes don't *replace* the trio, they inform it).
    """

    __table_args__ = (
        UniqueConstraint("application_id", "user_id", name="uq_application_user_like"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(index=True)
    user_id: str = Field(max_length=200, index=True)
    user_name: str = Field(default="", max_length=200)
    created_at: datetime = Field(default_factory=_utcnow)


class ApplicationComment(SQLModel, table=True):
    """A signed-in user's public comment on an application.

    Comments form a flat thread on /apply/public. The substantive count
    (≥ N words for some threshold N) feeds into Devin's vet
    recommendation as the "community discussion" signal.

    No unique constraint — users can comment multiple times. Soft-delete
    via ``hidden=True`` so we keep audit trail; production moderation
    UI can flip the flag.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(index=True)
    user_id: str = Field(max_length=200, index=True)
    user_name: str = Field(default="", max_length=200)
    body: str = Field(default="")
    hidden: bool = Field(default=False, index=True)
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
