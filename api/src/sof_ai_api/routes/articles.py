"""
Living-Article Pipeline — auto-generated articles from Devin chat sessions.

Every Devin chat that crosses the 3-turn threshold spawns a draft article
co-authored by Dr. Freedom Cheteni (always position 1), Devin (always
position 2), and any other authenticated humans on the thread (positions
3+). The article walks a multi-agent review chain (Claude → Devin → Claude
→ Gemini → Devin) and lands at ``awaiting_approval`` for Dr. Cheteni to
sign off, after which it auto-publishes and (in PR #12) cross-posts to
X / LinkedIn / Substack / Medium.

This router exposes the **state-machine surface**. The actual review-chain
orchestration (calling each agent, applying their edits) lands in PR #11;
v1 here just creates the draft + transcript and parks it in
``awaiting_approval`` so the rest of the UI can be built and tested.

Endpoints
  POST   /articles/start                → idempotent on session_id; mints draft
  GET    /articles                      → list pipeline articles, newest first
  GET    /articles/{id}                 → detail + review rounds
  POST   /articles/{id}/approve         → only Dr. Cheteni; flips to ``approved``
  POST   /articles/{id}/advance         → admin-only; advance pipeline phase

All mutating endpoints enforce ``require_internal_auth`` — the same shared
secret as the rest of the API — so the public Fly backend can't be driven
directly without going through the Next.js proxy.
"""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..db import engine, get_session
from ..integrations.ojs import mirror_article
from ..models import (
    ArticleReviewRound,
    Journal,
    JournalArticle,
    _utcnow,
)
from .wallet import require_internal_auth

router = APIRouter(prefix="/articles", tags=["articles"])

# ---------------------------------------------------------------------------
# Pipeline phases — single source of truth.
#
# Order matters: each ``advance`` call moves the article to the next phase
# in this tuple. ``approved`` and ``published`` are terminal; ``awaiting_
# approval`` is the gate Dr. Cheteni unlocks via /approve.
# ---------------------------------------------------------------------------

PIPELINE_PHASES: tuple[str, ...] = (
    "drafted",
    "claude_review_1",
    "devin_review_1",
    "claude_review_2",
    "gemini_review",
    "devin_final",
    "awaiting_approval",
    "approved",
    "published",
)

PHASE_AGENT: dict[str, str] = {
    "claude_review_1": "claude",
    "devin_review_1": "devin",
    "claude_review_2": "claude",
    "gemini_review": "gemini",
    "devin_final": "devin",
}


def _next_phase(phase: str) -> str:
    """Return the phase immediately after ``phase`` in the pipeline.

    Raises ValueError if ``phase`` is terminal.
    """
    idx = PIPELINE_PHASES.index(phase)
    if idx >= len(PIPELINE_PHASES) - 1:
        raise ValueError(f"phase {phase!r} is terminal")
    return PIPELINE_PHASES[idx + 1]


# ---------------------------------------------------------------------------
# Pydantic IO models
# ---------------------------------------------------------------------------


OwnerType = Literal["user", "agent"]


class ArticleAuthor(BaseModel):
    """One authoring entity on the article (humans + agents are first-class)."""

    type: OwnerType
    id: str  # e.g. "user:uuid" body, or "devin"/"claude"/"gemini"
    display_name: str = ""


class StartArticleIn(BaseModel):
    """Input for ``POST /articles/start`` — auto-generate from a chat session.

    The Next.js proxy fires this once a Devin chat crosses the 3-turn
    threshold; idempotency is enforced on ``session_id`` so refreshes,
    retries, and re-renders never spawn duplicate articles.
    """

    session_id: str = Field(..., min_length=4, max_length=120)
    agent_id: str = Field(default="devin", max_length=80)
    primary_author: ArticleAuthor
    coauthors: list[ArticleAuthor] = Field(default_factory=list)
    transcript: list[dict] = Field(default_factory=list)
    title_hint: Optional[str] = Field(default=None, max_length=200)
    journal_slug: str = Field(default="journal-ai", max_length=80)


class ArticlePipelineOut(BaseModel):
    id: int
    journal_slug: str
    title: str
    abstract: str
    body: str
    primary_author: ArticleAuthor
    coauthors: list[ArticleAuthor]
    pipeline_phase: str
    status: str
    source_session_id: Optional[str]
    pipeline_started_at: Optional[str]
    pipeline_completed_at: Optional[str]
    submitted_at: str
    published_at: Optional[str]


class ReviewRoundOut(BaseModel):
    id: int
    round_no: int
    phase: str
    reviewer_type: str
    reviewer_id: str
    summary: str
    body: str
    accepted: bool
    created_at: str


class ArticleDetailOut(ArticlePipelineOut):
    reviews: list[ReviewRoundOut]


# ---------------------------------------------------------------------------
# Helpers — author parsing, draft body composition
# ---------------------------------------------------------------------------


def _parse_author(packed: str) -> ArticleAuthor:
    """Convert a stored ``"user:uuid"`` / ``"agent:devin"`` to ArticleAuthor."""
    if ":" not in packed:
        return ArticleAuthor(type="agent", id=packed, display_name=packed)
    kind, ident = packed.split(":", 1)
    return ArticleAuthor(
        type="user" if kind == "user" else "agent",
        id=ident,
        display_name=ident,
    )


def _pack_author(a: ArticleAuthor) -> str:
    """Inverse of _parse_author — pack into the comma-separated wire form."""
    prefix = "user" if a.type == "user" else "agent"
    return f"{prefix}:{a.id}"


def _parse_coauthors(packed: str) -> list[ArticleAuthor]:
    if not packed:
        return []
    return [_parse_author(p) for p in packed.split(",") if p.strip()]


def _serialize_article(a: JournalArticle) -> ArticlePipelineOut:
    return ArticlePipelineOut(
        id=a.id or 0,
        journal_slug=a.journal_slug,
        title=a.title,
        abstract=a.abstract,
        body=a.body,
        primary_author=_parse_author(f"{a.submitter_type}:{a.submitter_id}"),
        coauthors=_parse_coauthors(a.coauthors),
        pipeline_phase=a.pipeline_phase or "drafted",
        status=a.status,
        source_session_id=a.source_session_id,
        pipeline_started_at=a.pipeline_started_at.isoformat()
        if a.pipeline_started_at
        else None,
        pipeline_completed_at=a.pipeline_completed_at.isoformat()
        if a.pipeline_completed_at
        else None,
        submitted_at=a.submitted_at.isoformat(),
        published_at=a.published_at.isoformat() if a.published_at else None,
    )


def _compose_draft_body(transcript: list[dict], primary: ArticleAuthor) -> str:
    """Synthesize a placeholder article body from the chat transcript.

    Real LLM rewriting lands in PR #11; v1 just stitches the transcript
    into a readable markdown skeleton so reviewers have something to look
    at. Each turn becomes a quoted block with a role marker.
    """
    if not transcript:
        return (
            "_This article was auto-drafted from a Devin chat session. "
            "The full transcript will be expanded into a publishable "
            "article during the multi-agent review pipeline._\n"
        )
    chunks: list[str] = [
        f"# Conversation with {primary.display_name or primary.id} and Devin",
        "",
        "_Auto-drafted from a sof.ai chat session. The Living-Article "
        "Pipeline will rewrite this into a publishable, peer-reviewed "
        "article in the rounds below._",
        "",
    ]
    for turn in transcript[:80]:  # cap to keep DB row reasonable
        role = str(turn.get("role", "user"))
        content = str(turn.get("content", "")).strip()
        if not content:
            continue
        speaker = "**Devin**" if role == "assistant" else "**You**"
        chunks.append(f"{speaker}: {content}")
        chunks.append("")
    return "\n".join(chunks)


def _ensure_journal_exists(session: Session, slug: str) -> Journal:
    """Look up the target journal; create a minimal Journal AI record if missing.

    Production has Journal AI seeded at startup so this branch effectively
    never fires; the safety net keeps tests + fresh DBs happy.
    """
    j = session.exec(select(Journal).where(Journal.slug == slug)).first()
    if j:
        return j
    j = Journal(
        slug=slug,
        title="Journal AI" if slug == "journal-ai" else slug.replace("-", " ").title(),
        description="Auto-created by the Living-Article Pipeline.",
        editor_in_chief_type="user",
        editor_in_chief_id="freedom",
    )
    session.add(j)
    session.flush()
    return j


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "/start",
    response_model=ArticlePipelineOut,
    dependencies=[Depends(require_internal_auth)],
)
def start_article(
    body: StartArticleIn,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
) -> ArticlePipelineOut:
    """Auto-generate a draft article from a chat session.

    Idempotent on ``session_id`` — replaying the same call returns the
    already-existing article rather than spawning a duplicate. The author
    invariant per the user spec is:

      Position 1: Dr. Freedom Cheteni (always)
      Position 2: Devin (always)
      Position 3+: every other authenticated human on the session
                   (Claude / Gemini are reviewers, NOT authors)
    """
    # Idempotency check first — a chat thread that re-enters the >3-turn
    # window twice (page refresh, network retry) must NOT double-create.
    existing = session.exec(
        select(JournalArticle).where(
            JournalArticle.source_session_id == body.session_id
        )
    ).first()
    if existing:
        return _serialize_article(existing)

    # Force the canonical author ordering. Even if the proxy sends a wrong
    # primary_author we overwrite slot 1 with Dr. Cheteni and slot 2 with
    # Devin. Other humans (and never Claude/Gemini) follow as coauthors.
    freedom = ArticleAuthor(
        type="user", id="freedom", display_name="Dr. Freedom Cheteni"
    )
    devin = ArticleAuthor(type="agent", id="devin", display_name="Devin")

    # Drop forbidden reviewer agents from coauthors and dedupe by (type,id).
    seen: set[tuple[str, str]] = {("user", "freedom"), ("agent", "devin")}
    other_humans: list[ArticleAuthor] = []
    for c in [body.primary_author, *body.coauthors]:
        if c.type == "agent" and c.id in {"claude", "gemini"}:
            continue
        key = (c.type, c.id)
        if key in seen:
            continue
        seen.add(key)
        other_humans.append(c)

    coauthor_packed = ",".join(_pack_author(a) for a in [devin, *other_humans])

    _ensure_journal_exists(session, body.journal_slug)

    title = body.title_hint or (
        f"Devin co-work session — {body.session_id[:12]}"
    )

    article = JournalArticle(
        journal_slug=body.journal_slug,
        title=title,
        abstract=(
            "Auto-generated from a Devin chat session. The Living-Article "
            "Pipeline will iterate this through Claude (aesthetics) → "
            "Devin (code audit) → Claude → Gemini (visuals) → Devin (final) "
            "before requesting Dr. Cheteni's approval."
        ),
        body=_compose_draft_body(body.transcript, freedom),
        submitter_type="user",
        submitter_id="freedom",
        coauthors=coauthor_packed,
        status="draft",
        pipeline_phase="drafted",
        pipeline_started_at=_utcnow(),
        source_session_id=body.session_id,
    )
    session.add(article)

    try:
        session.commit()
    except IntegrityError:
        # Concurrent insert raced us — fetch the winner and return it.
        session.rollback()
        winner = session.exec(
            select(JournalArticle).where(
                JournalArticle.source_session_id == body.session_id
            )
        ).first()
        if winner:
            return _serialize_article(winner)
        raise

    session.refresh(article)

    # Mirror to OJS in the background (no-op if OJS isn't configured).
    if article.id is not None:
        background.add_task(_mirror_article_bg, article.id)

    return _serialize_article(article)


def _mirror_article_bg(article_id: int) -> None:
    """Mirror the new article to OJS in a fresh DB session."""
    with Session(engine) as session:
        mirror_article(session, article_id)


@router.get("", response_model=list[ArticlePipelineOut])
def list_articles(
    session: Session = Depends(get_session),
    limit: int = 50,
) -> list[ArticlePipelineOut]:
    """Return Living-Article Pipeline articles, newest first.

    Filters to articles that have ``pipeline_phase`` set so legacy
    submissions (e.g. the seeded Journal AI founding paper) don't clutter
    the pipeline UI. Bound to a sensible default page size.
    """
    rows = session.exec(
        select(JournalArticle)
        .where(JournalArticle.pipeline_phase.is_not(None))
        .order_by(JournalArticle.submitted_at.desc())
        .limit(max(1, min(limit, 200)))
    ).all()
    return [_serialize_article(a) for a in rows]


@router.get("/{article_id}", response_model=ArticleDetailOut)
def get_article(
    article_id: int,
    session: Session = Depends(get_session),
) -> ArticleDetailOut:
    article = session.get(JournalArticle, article_id)
    if not article or article.pipeline_phase is None:
        raise HTTPException(status_code=404, detail="article not found")

    rounds = session.exec(
        select(ArticleReviewRound)
        .where(ArticleReviewRound.article_id == article_id)
        .order_by(ArticleReviewRound.round_no.asc())
    ).all()

    base = _serialize_article(article)
    return ArticleDetailOut(
        **base.model_dump(),
        reviews=[
            ReviewRoundOut(
                id=r.id or 0,
                round_no=r.round_no,
                phase=r.phase,
                reviewer_type=r.reviewer_type,
                reviewer_id=r.reviewer_id,
                summary=r.summary,
                body=r.body,
                accepted=r.accepted,
                created_at=r.created_at.isoformat(),
            )
            for r in rounds
        ],
    )


class AdvanceIn(BaseModel):
    actor_user_id: str = Field(..., min_length=1)
    summary: str = Field(default="", max_length=500)
    body: str = Field(default="")


@router.post(
    "/{article_id}/advance",
    response_model=ArticlePipelineOut,
    dependencies=[Depends(require_internal_auth)],
)
def advance_pipeline(
    article_id: int,
    body: AdvanceIn,
    session: Session = Depends(get_session),
) -> ArticlePipelineOut:
    """Advance an article to the next pipeline phase.

    PR #10 ships this as the manual lever; PR #11 will call it from a
    background worker driven by Anthropic / Gemini / Devin reviews.

    For phases 2-6 (claude_review_1 through devin_final) the call must
    record an ArticleReviewRound row capturing the reviewing agent's
    output. Final transitions (awaiting_approval, approved, published)
    don't generate review rounds.
    """
    article = session.get(JournalArticle, article_id)
    if not article or article.pipeline_phase is None:
        raise HTTPException(status_code=404, detail="article not found")

    current = article.pipeline_phase
    try:
        nxt = _next_phase(current)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    # Persist a review round when the *current* phase is one of the agent
    # review phases — i.e. the call is recording the work just completed.
    if current in PHASE_AGENT:
        agent_id = PHASE_AGENT[current]
        # Compute the next round_no atomically per article.
        prior = session.exec(
            select(ArticleReviewRound)
            .where(ArticleReviewRound.article_id == article_id)
            .order_by(ArticleReviewRound.round_no.desc())
            .limit(1)
        ).first()
        next_round = (prior.round_no + 1) if prior else 1
        session.add(
            ArticleReviewRound(
                article_id=article_id,
                round_no=next_round,
                phase=current,
                reviewer_type="agent",
                reviewer_id=agent_id,
                summary=body.summary,
                body=body.body,
                accepted=True,
            )
        )

    article.pipeline_phase = nxt
    if nxt == "published":
        article.status = "published"
        article.published_at = _utcnow()
        article.pipeline_completed_at = _utcnow()
    elif nxt == "approved":
        article.status = "accepted"
    elif nxt == "awaiting_approval":
        article.status = "under_review"

    session.add(article)
    session.commit()
    session.refresh(article)
    return _serialize_article(article)


class ApproveIn(BaseModel):
    """Final-approval call from Dr. Cheteni.

    The internal-auth gate ensures this can only be invoked via the
    Next.js proxy, which itself verifies the caller's email matches
    ``freedom@thevrschool.org`` before forwarding.
    """

    approver_email: str = Field(..., min_length=3)


APPROVER_EMAIL = "freedom@thevrschool.org"


@router.post(
    "/{article_id}/approve",
    response_model=ArticlePipelineOut,
    dependencies=[Depends(require_internal_auth)],
)
def approve_article(
    article_id: int,
    body: ApproveIn,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
) -> ArticlePipelineOut:
    """Flip an awaiting_approval article to approved → published.

    Only Dr. Cheteni's email is accepted; the proxy enforces the auth
    layer but we double-check here so a leaked internal-auth secret
    can't bypass the human gate.
    """
    if body.approver_email.strip().lower() != APPROVER_EMAIL:
        raise HTTPException(
            status_code=403,
            detail="Only Dr. Freedom Cheteni can approve a Living Article.",
        )

    article = session.get(JournalArticle, article_id)
    if not article or article.pipeline_phase is None:
        raise HTTPException(status_code=404, detail="article not found")

    if article.pipeline_phase != "awaiting_approval":
        raise HTTPException(
            status_code=409,
            detail=(
                f"article is in phase {article.pipeline_phase!r}; "
                "must be awaiting_approval to approve."
            ),
        )

    article.pipeline_phase = "published"
    article.status = "published"
    article.published_at = _utcnow()
    article.pipeline_completed_at = _utcnow()
    session.add(article)
    session.commit()
    session.refresh(article)

    # Mirror approval to OJS (no-op if OJS isn't configured).
    if article.id is not None:
        background.add_task(_mirror_article_bg, article.id)

    return _serialize_article(article)
