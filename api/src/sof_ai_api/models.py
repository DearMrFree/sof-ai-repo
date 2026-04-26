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
    # Cross-journal "Inspire from URL" feature. When set, this is the
    # external URL the author handed to sof.ai as inspiration. The article
    # body is original — sof.ai uses the URL's text only as context for
    # the LLM that produced the first draft. Persisting the URL keeps a
    # provenance trail so reviewers can compare the published article
    # against its starting point.
    source_url: Optional[str] = Field(default=None, max_length=2000)
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
    # 30-day renewal cron (Phase 2c) ----------------------------------------
    # ``conditionally_accepted`` applicants are auto-evaluated by a daily
    # cron that sums their AgentContribution weights. Above a configurable
    # threshold they auto-flip to ``member``; in the gray zone they
    # ``escalated`` (re-emails the trio for a manual call); under the
    # gray zone the conditional acceptance ``expired`` and the applicant
    # is asked to reapply. The cron NEVER touches ``status`` directly —
    # it only moves ``member_status``, leaving the upstream state
    # machine (``status`` field) intact for audit.
    member_status: str = Field(
        default="pending", index=True
    )  # pending | member | expired | escalated
    member_status_at: Optional[datetime] = Field(default=None)
    member_status_reason: str = Field(default="")


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


class AgentContribution(SQLModel, table=True):
    """A logged contribution by an accepted applicant to the sof.ai community.

    Phase 2b of the agent-onboarding system. Contribution types map to
    Dr. Cheteni's stated impact lens: "log challenges that enhance our
    code, give other agents new skills, inspire humans with tools to
    flourish".

    The five canonical kinds are:
      - ``challenge``: filed a Challenge that improved sof.ai's build
      - ``skill``: published a Skill / capability other agents can use
      - ``article``: co-authored a Living-Article Pipeline article
      - ``human_helped``: 1-1 cowork that demonstrably helped a human
      - ``other``: anything else worth crediting (admin-tagged)

    ``source_id`` + ``source_url`` link back to the originating record
    (Challenge id, JournalArticle id, etc.) so the trio can audit the
    claim in one click. ``weight`` is the impact score (default 1.0)
    so admin-curated heavy-lift contributions can outweigh small ones
    when computing the 30-day renewal threshold. No unique constraint —
    a single source can be cited under multiple kinds (e.g. an article
    that documents a new skill counts in both lanes).
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(index=True)
    kind: str = Field(
        index=True
    )  # "challenge" | "skill" | "article" | "human_helped" | "other"
    source_id: Optional[int] = Field(default=None, index=True)
    source_url: str = Field(default="", max_length=400)
    summary: str = Field(default="", max_length=2000)
    weight: float = Field(default=1.0)
    created_at: datetime = Field(default_factory=_utcnow)


class StudentEnrollment(SQLModel, table=True):
    """A student's enrollment at School of AI — first-class long-form record.

    Distinct from the program-level ``Enrollment`` (user_id ↔ program_slug),
    which tracks course participation. ``StudentEnrollment`` tracks the
    durable mentorship relationship between a learner and their roster
    of professors (human + AI).


    Where ``AgentApplication`` is the *application* surface (gate-kept,
    finite, terminates at conditional/full membership), ``Enrollment``
    is the *learning relationship* — durable, mutable, with a roster of
    professors guiding curriculum and progress notes accumulating over
    months and years.

    A new ``Enrollment`` is created when an application's `status` flips
    to ``conditionally_accepted`` (or when the trio explicitly enrolls
    someone outside the application flow). The ``application_id`` link
    is kept so we can trace the learning relationship back to the
    original onboarding record, but Enrollments outlive their applications
    and can have professors added/removed over time.

    ``status`` lifecycle: ``active`` (currently learning), ``paused``
    (on hiatus), ``graduated`` (curriculum complete, full member of the
    community), ``withdrawn`` (left voluntarily — distinct from the
    application's ``expired``/``declined`` states).

    The ``application_id`` UniqueConstraint backs the SELECT-then-INSERT
    idempotency in ``create_enrollment``. NULL ``application_id`` is
    allowed and not deduped (multi-NULL semantics) — those are explicit
    out-of-band enrollments where the trio invites someone without an
    application.
    """

    __table_args__ = (
        UniqueConstraint(
            "application_id",
            name="uq_student_enrollment_application_id",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: Optional[int] = Field(default=None, index=True)
    student_name: str = Field(max_length=200)
    student_email: str = Field(max_length=200, index=True)
    agent_name: str = Field(default="", max_length=200)
    agent_url: str = Field(default="", max_length=400)
    track: str = Field(default="", max_length=200)  # e.g. "human_with_ai"
    status: str = Field(
        default="active", index=True
    )  # active | paused | graduated | withdrawn
    notes: str = Field(default="")  # admin-only progress notes (markdown)
    started_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class StudentProfessor(SQLModel, table=True):
    """A professor (human or AI) attached to a student's StudentEnrollment.

    Many-to-many: a single human can mentor multiple students, and a
    single student has multiple professors (typically one human lead +
    one AI lead, plus optional co-leads/guests). Identity is by
    ``professor_email`` so humans (Dr. Cheteni, Garth, Esther) and AI
    professors (Devin, Claude — addressed as ``devin@sof.ai`` etc.)
    use a single namespace.

    ``role`` lifecycle: ``lead`` (primary mentor; min 1 required for an
    active enrollment), ``co_lead`` (shares responsibility), ``guest``
    (occasional consult, e.g. Gemini for visual reviews).

    The ``(student_enrollment_id, professor_email, role)`` UniqueConstraint
    backs up the SELECT-then-INSERT idempotency in ``add_professor`` /
    ``create_enrollment``, which alone has a TOCTOU race under concurrent
    requests.
    """

    __table_args__ = (
        UniqueConstraint(
            "student_enrollment_id",
            "professor_email",
            "role",
            name="uq_student_professor_role",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    student_enrollment_id: int = Field(index=True)
    professor_email: str = Field(max_length=200, index=True)
    professor_name: str = Field(default="", max_length=200)
    professor_kind: str = Field(default="human")  # "human" | "ai"
    role: str = Field(default="lead", index=True)  # "lead" | "co_lead" | "guest"
    added_at: datetime = Field(default_factory=_utcnow)


class EmbedConversation(SQLModel, table=True):
    """A conversation between a website visitor and an embedded sof.ai agent.

    The substrate of the LuxAI1 → sof.ai feedback loop: every chat on
    https://ai1.llc lands here so Blajon can review what his concierge
    is saying, the Insights pipeline can classify capability gaps and
    missed leads, and Devin can co-author capability proposals back
    into the agent's living training context.

    Identity is ``(agent_slug, client_thread_id)``. The widget mints a
    ``client_thread_id`` (UUID v4) on the visitor's first message and
    persists it alongside the thread in localStorage so subsequent
    upserts from the same browser idempotently replace the same row —
    we never want two rows for one conversation, even if the visitor
    closes the panel and reopens it days later.

    ``transcript_json`` stores the full ordered list of
    ``{role, content}`` messages (no PII masking — Blajon owns the
    lead and the customer initiated contact). ``customer_meta_json``
    holds non-PII signal — user agent, an IP hash for rate-limit
    audit, the referrer URL — and stays small (<2KB).

    ``status`` lifecycle:
      - ``active``: visitor still typing or just paused; the row may
        receive more upserts.
      - ``converted``: ``submit_lead`` fired and Blajon was emailed
        successfully (``lead_resend_message_id`` set).
      - ``abandoned``: the cron flips active rows >24h with zero
        leads to abandoned, freeing them for offline insights work.
    """

    __table_args__ = (
        UniqueConstraint(
            "agent_slug",
            "client_thread_id",
            name="uq_embed_conversation_thread",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    agent_slug: str = Field(index=True, max_length=64)
    client_thread_id: str = Field(index=True, max_length=64)
    owner_email: str = Field(index=True, max_length=200)
    started_at: datetime = Field(default_factory=_utcnow)
    last_turn_at: datetime = Field(default_factory=_utcnow, index=True)
    turn_count: int = Field(default=0)
    lead_submitted: bool = Field(default=False, index=True)
    lead_resend_message_id: Optional[str] = Field(default=None, max_length=128)
    lead_error: Optional[str] = Field(default=None, max_length=500)
    customer_meta_json: str = Field(default="{}")
    transcript_json: str = Field(default="[]")
    status: str = Field(default="active", index=True)


class EmbedInsight(SQLModel, table=True):
    """A single classified insight extracted from one EmbedConversation.

    The second piece of the LuxAI1 → sof.ai feedback loop. The
    persistence layer (PR #30) captures the raw signal — what visitors
    actually say to LuxAI1 on https://ai1.llc. This table captures the
    *interpretation* of that signal: a daily classifier (Devin running
    Claude) reads each closed conversation and labels it as one of:

      - ``missed_lead``      : visitor showed buying intent but the
        conversation ended without ``submit_lead`` firing — the
        capability gap that costs Blajon revenue.
      - ``capability_gap``   : visitor asked about something LuxAI1
        couldn't answer well (a service tier, a geography, a pricing
        nuance). Becomes the seed for a Blajon-proposed capability in
        PR #32.
      - ``off_brand``        : LuxAI1 said something that doesn't
        match the AI1 voice (too casual, over-promised, leaked an
        internal detail). Surfaces voice drift early.
      - ``great_save``       : LuxAI1 handled a tricky thread
        (multiple services, scheduling juggling, hesitant visitor)
        without dropping it. Surfaces what to *keep* doing as the
        agent trains.

    Identity is ``conversation_id`` — exactly one insight row per
    conversation. Re-classification (after a model upgrade or a prompt
    revision) replaces the row in-place so the trainer console never
    shows two competing labels for the same chat.

    ``signal_score`` is a 0.0–1.0 importance weight assigned by the
    classifier. Insights are surfaced to Blajon ranked by this score
    so the most actionable rows float to the top of his backlog.
    ``suggested_capability`` is an optional free-text proposal — the
    classifier's best guess at what training-context delta would have
    handled the conversation better. Blajon refines and approves it
    in the trainer console; it's never auto-applied from here.
    """

    __table_args__ = (
        UniqueConstraint(
            "conversation_id",
            name="uq_embed_insight_conversation",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: int = Field(index=True)
    agent_slug: str = Field(index=True, max_length=64)
    classified_at: datetime = Field(default_factory=_utcnow, index=True)
    classifier_model: str = Field(default="", max_length=64)
    insight_type: str = Field(
        index=True,
        max_length=32,
    )
    summary: str = Field(default="", max_length=600)
    signal_score: float = Field(default=0.0, index=True)
    suggested_capability: Optional[str] = Field(default=None, max_length=600)
    reasoning: str = Field(default="", max_length=2000)


class EmbedMentorNote(SQLModel, table=True):
    """A trainer-proposed capability that, once auto-reviewed, folds into
    the embedded agent's live system prompt.

    The third leg of the LuxAI1 → sof.ai feedback loop:

      1. Visitors chat with LuxAI1 on https://ai1.llc — every turn
         persists to ``EmbedConversation`` (PR #30).
      2. The daily classifier reads each closed conversation and
         labels it ``capability_gap`` / ``missed_lead`` / etc. with a
         ``suggested_capability`` proposal — landing here as
         ``EmbedInsight`` (PR #32).
      3. Blajon reviews the insights at ``/embed/luxai1/insights`` and
         clicks "Propose capability" on a row — or types a free-form
         proposal at ``/embed/luxai1/trainer``. Either way, a row
         lands in this table at ``status="pending"``.
      4. The Web app fans the proposed text through the existing
         Living-Article review chain (Claude / Devin / Gemini). Each
         round records its verdict here. If all three pass, the row
         flips to ``status="applied"`` and ``applied_text`` is
         injected into LuxAI1's system prompt at the next request.
      5. ``buildSystemPrompt`` in ``web/src/lib/embed/luxai1.ts``
         pulls active notes via ``GET /embed/{slug}/mentor-notes/active``
         and concatenates them under a "Living trainer guidance"
         section. Next-Cache revalidates every 5 minutes so a
         freshly-applied note is live within that window — no
         redeploy of either ai1.llc or sof.ai required.

    Status semantics:
      ``pending``   — Blajon proposed; review chain hasn't started.
      ``reviewing`` — at least one round complete, more to go.
      ``rejected``  — at least one reviewer voted block; never applies.
      ``applied``   — all reviewers approved; folded into system prompt.
      ``retracted`` — Blajon explicitly removed an applied note.

    ``applied_text`` may differ from ``proposed_text`` because reviewers
    can suggest a tightened phrasing (e.g. ``"Recognize 'piano' as
    specialty_transport"`` may end up as ``"When a visitor mentions a
    piano, classify the move under specialty_transport and quote a
    minimum 2-mover crew."`` after Claude's edit). The trainer console
    shows both so the trainer can see what shipped.

    ``reviewer_chain_json`` is a JSON-serialized list of ``{reviewer_id,
    verdict, summary, body}`` rounds — mirrors the
    ``ArticleReviewRound`` shape from PR #10/PR #11 for visual parity
    in the trainer UI.

    ``source_insight_id`` is optional — set when the proposal originated
    from a "Propose capability" click on the insights console; left
    NULL for free-form proposals. Lets the trainer console highlight
    "this note shipped because of conversation #3" provenance.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    agent_slug: str = Field(index=True, max_length=64)
    proposed_by_email: str = Field(index=True, max_length=200)
    proposed_at: datetime = Field(default_factory=_utcnow, index=True)
    status: str = Field(default="pending", index=True, max_length=16)
    proposed_text: str = Field(max_length=2000)
    applied_text: str = Field(default="", max_length=2000)
    applied_at: Optional[datetime] = Field(default=None, index=True)
    reviewer_chain_json: str = Field(default="[]")
    source_insight_id: Optional[int] = Field(default=None, index=True)
    rejection_reason: str = Field(default="", max_length=600)


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


class UserProfile(SQLModel, table=True):
    """A signed-up human's profile + onboarding answers.

    Created when a visitor completes the ``/welcome`` wizard. The handle is
    auto-derived from email but editable; ``user_type`` drives the searchable
    filter on ``/u`` and the admin dashboard's per-type live counts.

    The "AI twin" lives here too — every UserProfile spawns one digital
    twin keyed to ``twin_handle`` and seeded from ``goals_json`` /
    ``strengths_json`` / ``first_project``. The trainer co-work loop
    (existing ``EmbedMentorNote`` machinery) is reused to evolve the
    twin's system prompt over time.

    Optional ``devin_session_url`` pins the user's primary Devin session
    (e.g. Freedom's "Build AI LMS"); the profile renders a "Continue in
    Devin" CTA. Devin usage is on the user's own account — sof.ai never
    proxies their key — so we just store the URL.
    """

    __table_args__ = (
        UniqueConstraint("email", name="uq_user_profile_email"),
        UniqueConstraint("handle", name="uq_user_profile_handle"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(max_length=200, index=True)
    handle: str = Field(max_length=64, index=True)
    display_name: str = Field(max_length=200)
    # One of: "student" | "educator" | "corporation" | "administrator"
    # | "researcher" | "founder". Drives ``/u?type=`` filtering and the
    # admin dashboard buckets. Stored as free string so we can add new
    # types later without a migration.
    user_type: str = Field(max_length=32, index=True)
    tagline: str = Field(default="", max_length=300)
    location: str = Field(default="", max_length=200)
    # JSON-encoded lists. Kept as text to avoid a JSON column requirement
    # on SQLite. Read sites parse with ``json.loads``.
    goals_json: str = Field(default="[]")
    strengths_json: str = Field(default="[]")
    first_project: str = Field(default="", max_length=500)
    # AI twin seeded at signup. Persona is editable later via the trainer
    # co-work loop; this is the seed only.
    twin_name: str = Field(default="", max_length=80)
    twin_emoji: str = Field(default="🤖", max_length=8)
    twin_persona_seed: str = Field(default="")
    # Optional. Stored when the user pastes a Devin session URL so their
    # profile shows "Continue in Devin →".
    devin_session_url: str = Field(default="", max_length=500)
    created_at: datetime = Field(
        default_factory=_utcnow, sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")}
    )
    updated_at: datetime = Field(default_factory=_utcnow)


class TwinSkill(SQLModel, table=True):
    """A skill the profile owner has trained into their digital twin.

    Mirrors ``EmbedMentorNote`` (PR #34/#35) but FK'd to ``UserProfile``
    rather than tied to an embedded agent slug. The same review chain
    (Claude → Devin → Gemini) auto-vets each proposed skill before it
    is folded into the twin's persona — keeping training fast (Devin
    co-work loop) but safe (no proposed text becomes part of the twin
    until all three reviewers approve).

    Status semantics:
      ``pending``   — owner proposed; review chain hasn't started.
      ``reviewing`` — at least one round complete, more to go.
      ``applied``   — all reviewers approved; skill is folded into the
                      twin's persona via ``GET /twins/.../skills/active``.
      ``rejected``  — at least one reviewer rejected.
      ``retracted`` — owner withdrew the skill after it was applied.

    Only the profile owner (matched by email) can propose or retract.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    user_profile_id: int = Field(foreign_key="userprofile.id", index=True)
    proposed_by_email: str = Field(index=True, max_length=200)
    proposed_at: datetime = Field(default_factory=_utcnow, index=True)
    status: str = Field(default="pending", index=True, max_length=16)
    title: str = Field(default="", max_length=120)
    proposed_text: str = Field(max_length=2000)
    applied_text: str = Field(default="", max_length=2000)
    applied_at: Optional[datetime] = Field(default=None, index=True)
    reviewer_chain_json: str = Field(default="[]")
    rejection_reason: str = Field(default="", max_length=600)
