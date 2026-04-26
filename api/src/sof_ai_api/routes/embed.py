"""Embed routes — conversations + insights for embedded agents.

Backs the LuxAI1 → sof.ai training-data feedback loop. Every chat on
https://ai1.llc gets persisted here via an internal-only upsert from
the Web app's ``/api/embed/[slug]/chat`` route. The daily insights
cron then classifies each closed conversation (PR #33) so Blajon and
the lead professors can spot capability gaps quickly.

Surface:
  * POST /embed/conversations/upsert        — internal-auth, idempotent
  * GET  /embed/{slug}/conversations        — internal-auth, paginated
  * GET  /embed/conversations/{id}          — internal-auth, full transcript
  * POST /embed/conversations/cron/abandon  — internal-auth, mark stale active
  * POST /embed/insights/upsert             — internal-auth, idempotent
  * GET  /embed/{slug}/insights             — internal-auth, ranked list
  * GET  /embed/{slug}/insights/pending     — internal-auth, classifier work-queue
  * POST /embed/{slug}/mentor-notes         — internal-auth, propose new note
  * POST /embed/mentor-notes/{id}/round     — internal-auth, append review round
  * POST /embed/mentor-notes/{id}/finalize  — internal-auth, flip to applied/rejected
  * POST /embed/mentor-notes/{id}/retract   — internal-auth, retract an applied note
  * GET  /embed/{slug}/mentor-notes         — internal-auth, list (filterable)
  * GET  /embed/{slug}/mentor-notes/active  — public-read, applied notes for prompt
"""
from __future__ import annotations

import json
from datetime import UTC, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..db import get_session
from ..models import EmbedConversation, EmbedInsight, EmbedMentorNote, _utcnow
from .wallet import require_internal_auth

router = APIRouter(prefix="/embed", tags=["embed"])


# ---------------------------------------------------------------------------
# Pydantic IO
# ---------------------------------------------------------------------------


class TranscriptMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., max_length=8000)


class UpsertConversationIn(BaseModel):
    agent_slug: str = Field(..., min_length=1, max_length=64)
    client_thread_id: str = Field(..., min_length=8, max_length=64)
    owner_email: str = Field(..., min_length=3, max_length=200)
    transcript: list[TranscriptMessage] = Field(default_factory=list)
    customer_meta: dict[str, Any] = Field(default_factory=dict)
    lead_submitted: bool = False
    lead_resend_message_id: Optional[str] = Field(default=None, max_length=128)
    lead_error: Optional[str] = Field(default=None, max_length=500)
    status: Optional[str] = Field(
        default=None, pattern="^(active|converted|abandoned)$"
    )


class ConversationOut(BaseModel):
    id: int
    agent_slug: str
    client_thread_id: str
    owner_email: str
    started_at: str
    last_turn_at: str
    turn_count: int
    lead_submitted: bool
    lead_resend_message_id: Optional[str]
    lead_error: Optional[str]
    customer_meta: dict[str, Any]
    transcript: list[TranscriptMessage]
    status: str


class ConversationSummary(BaseModel):
    """Light row for the list view — no transcript body."""

    id: int
    agent_slug: str
    client_thread_id: str
    started_at: str
    last_turn_at: str
    turn_count: int
    lead_submitted: bool
    lead_error: Optional[str]
    status: str
    preview: str  # first ~80 chars of the visitor's first message


class ConversationListOut(BaseModel):
    items: list[ConversationSummary]
    total: int
    converted_total: int


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------


def _safe_load_json(raw: str, fallback: Any) -> Any:
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return fallback


def _serialize_full(c: EmbedConversation) -> ConversationOut:
    transcript_raw = _safe_load_json(c.transcript_json, [])
    transcript: list[TranscriptMessage] = []
    if isinstance(transcript_raw, list):
        for item in transcript_raw:
            if (
                isinstance(item, dict)
                and item.get("role") in ("user", "assistant")
                and isinstance(item.get("content"), str)
            ):
                transcript.append(
                    TranscriptMessage(role=item["role"], content=item["content"])
                )
    meta = _safe_load_json(c.customer_meta_json, {})
    if not isinstance(meta, dict):
        meta = {}
    return ConversationOut(
        id=c.id or 0,
        agent_slug=c.agent_slug,
        client_thread_id=c.client_thread_id,
        owner_email=c.owner_email,
        started_at=c.started_at.isoformat() if c.started_at else "",
        last_turn_at=c.last_turn_at.isoformat() if c.last_turn_at else "",
        turn_count=c.turn_count,
        lead_submitted=c.lead_submitted,
        lead_resend_message_id=c.lead_resend_message_id,
        lead_error=c.lead_error,
        customer_meta=meta,
        transcript=transcript,
        status=c.status,
    )


def _serialize_summary(c: EmbedConversation) -> ConversationSummary:
    transcript_raw = _safe_load_json(c.transcript_json, [])
    preview = ""
    if isinstance(transcript_raw, list):
        for item in transcript_raw:
            if (
                isinstance(item, dict)
                and item.get("role") == "user"
                and isinstance(item.get("content"), str)
            ):
                first = item["content"].strip().replace("\n", " ")
                preview = first[:80] + ("…" if len(first) > 80 else "")
                break
    return ConversationSummary(
        id=c.id or 0,
        agent_slug=c.agent_slug,
        client_thread_id=c.client_thread_id,
        started_at=c.started_at.isoformat() if c.started_at else "",
        last_turn_at=c.last_turn_at.isoformat() if c.last_turn_at else "",
        turn_count=c.turn_count,
        lead_submitted=c.lead_submitted,
        lead_error=c.lead_error,
        status=c.status,
        preview=preview,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "/conversations/upsert",
    response_model=ConversationOut,
    dependencies=[Depends(require_internal_auth)],
)
def upsert_conversation(
    payload: UpsertConversationIn,
    session: Session = Depends(get_session),
) -> ConversationOut:
    """Idempotent upsert by ``(agent_slug, client_thread_id)``.

    Called by the Web app's chat route after every turn. The web side
    is responsible for assembling the up-to-date transcript and passing
    in the cumulative state — this endpoint just persists it.

    Concurrency: if the row doesn't exist yet, two simultaneous upserts
    can race past the SELECT. The unique constraint catches that at
    INSERT time; we then fall back to a SELECT-then-UPDATE.
    """
    transcript_payload = [m.model_dump() for m in payload.transcript]

    existing = session.exec(
        select(EmbedConversation).where(
            EmbedConversation.agent_slug == payload.agent_slug,
            EmbedConversation.client_thread_id == payload.client_thread_id,
        )
    ).first()

    if existing is None:
        derived_status = payload.status or (
            "converted" if payload.lead_submitted else "active"
        )
        row = EmbedConversation(
            agent_slug=payload.agent_slug,
            client_thread_id=payload.client_thread_id,
            owner_email=payload.owner_email,
            turn_count=len(transcript_payload),
            lead_submitted=payload.lead_submitted,
            lead_resend_message_id=payload.lead_resend_message_id,
            lead_error=payload.lead_error,
            customer_meta_json=json.dumps(payload.customer_meta),
            transcript_json=json.dumps(transcript_payload),
            status=derived_status,
        )
        session.add(row)
        try:
            session.commit()
        except IntegrityError:
            # Race: another upsert created the row in parallel. Roll
            # back, re-fetch, and fall through to the update branch.
            session.rollback()
            existing = session.exec(
                select(EmbedConversation).where(
                    EmbedConversation.agent_slug == payload.agent_slug,
                    EmbedConversation.client_thread_id == payload.client_thread_id,
                )
            ).first()
            if existing is None:
                # Vanishingly unlikely, but never lie about success.
                raise HTTPException(
                    status_code=500,
                    detail="conversation_upsert_race",
                ) from None
        else:
            session.refresh(row)
            return _serialize_full(row)

    # Update path. Only overwrite fields the caller explicitly sent.
    existing.transcript_json = json.dumps(transcript_payload)
    existing.turn_count = len(transcript_payload)
    existing.last_turn_at = _utcnow()
    if payload.customer_meta:
        # Merge, don't replace — UA/IP/referrer recorded on turn 1
        # shouldn't be erased by a later upsert that omits them.
        prior = _safe_load_json(existing.customer_meta_json, {})
        if not isinstance(prior, dict):
            prior = {}
        prior.update(payload.customer_meta)
        existing.customer_meta_json = json.dumps(prior)
    # `lead_submitted` is monotonic — never flip it back to False.
    if payload.lead_submitted and not existing.lead_submitted:
        existing.lead_submitted = True
    if payload.lead_resend_message_id and not existing.lead_resend_message_id:
        existing.lead_resend_message_id = payload.lead_resend_message_id
    if payload.lead_error is not None:
        existing.lead_error = payload.lead_error
    if payload.status:
        existing.status = payload.status
    elif existing.lead_submitted and existing.status == "active":
        existing.status = "converted"

    session.add(existing)
    session.commit()
    session.refresh(existing)
    return _serialize_full(existing)


@router.get(
    "/{slug}/conversations",
    response_model=ConversationListOut,
    dependencies=[Depends(require_internal_auth)],
)
def list_conversations(
    slug: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    status: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
) -> ConversationListOut:
    # Build the page query with status pushed into SQL so LIMIT/OFFSET
    # operate on the filtered set. Filtering in Python after .limit()
    # silently truncates pages: a caller asking for `?status=active&
    # limit=50` would get fewer than 50 even when more matching rows
    # exist past the page boundary.
    page_query = select(EmbedConversation).where(
        EmbedConversation.agent_slug == slug
    )
    if status:
        page_query = page_query.where(EmbedConversation.status == status)
    rows = session.exec(
        page_query.order_by(EmbedConversation.last_turn_at.desc())  # type: ignore[union-attr]
        .offset(offset)
        .limit(limit)
    ).all()

    # Aggregate counts run on the unfiltered slug query so the list page
    # can surface "23 conversations · 2 leads" regardless of pagination
    # or which status the caller is currently scoping to.
    all_rows = session.exec(
        select(EmbedConversation).where(EmbedConversation.agent_slug == slug)
    ).all()
    total = len(all_rows)
    converted_total = sum(1 for r in all_rows if r.lead_submitted)

    return ConversationListOut(
        items=[_serialize_summary(r) for r in rows],
        total=total,
        converted_total=converted_total,
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationOut,
    dependencies=[Depends(require_internal_auth)],
)
def get_conversation(
    conversation_id: int,
    session: Session = Depends(get_session),
) -> ConversationOut:
    row = session.get(EmbedConversation, conversation_id)
    if row is None:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    return _serialize_full(row)


class AbandonStaleOut(BaseModel):
    abandoned: int


@router.post(
    "/conversations/cron/abandon",
    response_model=AbandonStaleOut,
    dependencies=[Depends(require_internal_auth)],
)
def abandon_stale_conversations(
    older_than_hours: int = Query(default=24, ge=1, le=24 * 30),
    session: Session = Depends(get_session),
) -> AbandonStaleOut:
    """Mark long-idle ``active`` conversations as ``abandoned``.

    Lets the insights pipeline (PR #31) treat the row as a closed unit
    of work without contending with a still-typing visitor.
    """
    cutoff = _utcnow() - timedelta(hours=older_than_hours)
    rows = session.exec(
        select(EmbedConversation).where(
            EmbedConversation.status == "active",
            EmbedConversation.last_turn_at < cutoff,
        )
    ).all()
    for r in rows:
        r.status = "abandoned"
        session.add(r)
    if rows:
        session.commit()
    return AbandonStaleOut(abandoned=len(rows))


# ---------------------------------------------------------------------------
# Insights — classified labels for closed conversations (PR #33)
# ---------------------------------------------------------------------------
#
# The web-side cron (Vercel) walks the work-queue returned by
# ``GET /embed/{slug}/insights/pending``, runs Anthropic on each
# transcript, and POSTs the structured result back to
# ``/embed/insights/upsert``. We keep the LLM call on the Vercel side
# so the FastAPI deploy doesn't need to ship anthropic + a key, and so
# the cron can be re-run safely (the upsert is idempotent on
# ``conversation_id``).


_INSIGHT_TYPES = {"missed_lead", "capability_gap", "off_brand", "great_save"}


class UpsertInsightIn(BaseModel):
    conversation_id: int
    insight_type: str = Field(..., min_length=1, max_length=32)
    summary: str = Field(default="", max_length=600)
    signal_score: float = Field(default=0.0, ge=0.0, le=1.0)
    suggested_capability: Optional[str] = Field(default=None, max_length=600)
    reasoning: str = Field(default="", max_length=2000)
    classifier_model: str = Field(default="", max_length=64)


class InsightOut(BaseModel):
    id: int
    conversation_id: int
    agent_slug: str
    classified_at: str
    classifier_model: str
    insight_type: str
    summary: str
    signal_score: float
    suggested_capability: Optional[str]
    reasoning: str


class InsightWithConversation(BaseModel):
    """Insight + the conversation summary it was extracted from.

    The list view at ``/embed/{slug}/insights`` joins the two so the
    trainer console can render "Missed lead — piano move SF→PA · 84%
    signal" alongside a one-line preview without a second round-trip.
    """

    insight: InsightOut
    conversation: ConversationSummary


class InsightListOut(BaseModel):
    items: list[InsightWithConversation]
    total: int
    by_type: dict[str, int]


class PendingConversationOut(BaseModel):
    """A row the classifier needs to look at.

    The full transcript is included so the cron can run Anthropic in
    one shot without a follow-up GET to ``/embed/conversations/{id}``.
    """

    conversation: ConversationOut


class PendingListOut(BaseModel):
    items: list[PendingConversationOut]
    total: int


def _serialize_insight(row: EmbedInsight) -> InsightOut:
    return InsightOut(
        id=row.id or 0,
        conversation_id=row.conversation_id,
        agent_slug=row.agent_slug,
        classified_at=row.classified_at.isoformat() if row.classified_at else "",
        classifier_model=row.classifier_model,
        insight_type=row.insight_type,
        summary=row.summary,
        signal_score=row.signal_score,
        suggested_capability=row.suggested_capability,
        reasoning=row.reasoning,
    )


@router.post(
    "/insights/upsert",
    response_model=InsightOut,
    dependencies=[Depends(require_internal_auth)],
)
def upsert_insight(
    payload: UpsertInsightIn,
    session: Session = Depends(get_session),
) -> InsightOut:
    """Idempotent insight write keyed on ``conversation_id``.

    The classifier may run multiple times against the same conversation
    (model upgrade, prompt revision, manual re-trigger). We replace the
    existing row in-place rather than appending so the trainer console
    never sees two competing labels for one chat.
    """
    if payload.insight_type not in _INSIGHT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"insight_type must be one of {sorted(_INSIGHT_TYPES)}",
        )

    conversation = session.get(EmbedConversation, payload.conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="conversation_not_found")

    existing = session.exec(
        select(EmbedInsight).where(
            EmbedInsight.conversation_id == payload.conversation_id
        )
    ).first()

    if existing is None:
        row = EmbedInsight(
            conversation_id=payload.conversation_id,
            agent_slug=conversation.agent_slug,
            insight_type=payload.insight_type,
            summary=payload.summary,
            signal_score=payload.signal_score,
            suggested_capability=payload.suggested_capability,
            reasoning=payload.reasoning,
            classifier_model=payload.classifier_model,
        )
        session.add(row)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            existing = session.exec(
                select(EmbedInsight).where(
                    EmbedInsight.conversation_id == payload.conversation_id
                )
            ).first()
            if existing is None:
                raise HTTPException(
                    status_code=500,
                    detail="insight_upsert_race",
                ) from None
        else:
            session.refresh(row)
            return _serialize_insight(row)

    existing.insight_type = payload.insight_type
    existing.summary = payload.summary
    existing.signal_score = payload.signal_score
    existing.suggested_capability = payload.suggested_capability
    existing.reasoning = payload.reasoning
    existing.classifier_model = payload.classifier_model
    existing.classified_at = _utcnow()
    session.add(existing)
    session.commit()
    session.refresh(existing)
    return _serialize_insight(existing)


@router.get(
    "/{slug}/insights",
    response_model=InsightListOut,
    dependencies=[Depends(require_internal_auth)],
)
def list_insights(
    slug: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    insight_type: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
) -> InsightListOut:
    """Insights for ``slug``, ranked by ``signal_score`` descending.

    The default ordering surfaces the most actionable rows first so the
    trainer console at ``/embed/{slug}/insights`` doesn't need to
    re-sort client-side. ``insight_type`` filters at SQL level so
    LIMIT/OFFSET pagination stays correct under filtering.
    """
    page_query = select(EmbedInsight).where(EmbedInsight.agent_slug == slug)
    if insight_type:
        if insight_type not in _INSIGHT_TYPES:
            raise HTTPException(
                status_code=422,
                detail=f"insight_type must be one of {sorted(_INSIGHT_TYPES)}",
            )
        page_query = page_query.where(EmbedInsight.insight_type == insight_type)
    rows = session.exec(
        page_query.order_by(
            EmbedInsight.signal_score.desc(),  # type: ignore[union-attr]
            EmbedInsight.classified_at.desc(),  # type: ignore[union-attr]
        )
        .offset(offset)
        .limit(limit)
    ).all()

    # Aggregates run on the unfiltered slug query so the chip counts
    # ("12 missed leads · 4 capability gaps") stay stable as the user
    # filters or paginates.
    all_rows = session.exec(
        select(EmbedInsight).where(EmbedInsight.agent_slug == slug)
    ).all()
    by_type: dict[str, int] = {t: 0 for t in _INSIGHT_TYPES}
    for r in all_rows:
        by_type[r.insight_type] = by_type.get(r.insight_type, 0) + 1

    # Hydrate each insight with its source conversation summary so the
    # list page can show the visitor's first message inline.
    convo_ids = {r.conversation_id for r in rows}
    convo_map: dict[int, EmbedConversation] = {}
    if convo_ids:
        convos = session.exec(
            select(EmbedConversation).where(EmbedConversation.id.in_(convo_ids))  # type: ignore[union-attr]
        ).all()
        convo_map = {c.id: c for c in convos if c.id is not None}

    items: list[InsightWithConversation] = []
    for r in rows:
        c = convo_map.get(r.conversation_id)
        if c is None:
            # Conversation was deleted between the index and the join.
            # Skip rather than 500 — the orphan insight will get cleaned
            # up by a future maintenance pass.
            continue
        items.append(
            InsightWithConversation(
                insight=_serialize_insight(r),
                conversation=_serialize_summary(c),
            )
        )

    return InsightListOut(
        items=items,
        total=len(all_rows),
        by_type=by_type,
    )


@router.get(
    "/{slug}/insights/pending",
    response_model=PendingListOut,
    dependencies=[Depends(require_internal_auth)],
)
def list_pending_insights(
    slug: str,
    older_than_minutes: int = Query(default=5, ge=0, le=60 * 24),
    limit: int = Query(default=25, ge=1, le=100),
    session: Session = Depends(get_session),
) -> PendingListOut:
    """Closed conversations the classifier hasn't labeled yet.

    A conversation is "pending classification" when:
      - ``status`` is ``converted`` or ``abandoned`` (so the visitor
        isn't still mid-message), OR ``last_turn_at`` is at least
        ``older_than_minutes`` old (covers active rows that paused).
      - There is no EmbedInsight row joined on ``conversation_id``.

    The cron walks this queue and POSTs results to
    ``/embed/insights/upsert``. Re-runs are safe — once the upsert
    lands, the row leaves the pending list automatically.
    """
    # Subquery: every conversation_id that already has an insight.
    classified_ids = set(
        session.exec(
            select(EmbedInsight.conversation_id).where(
                EmbedInsight.agent_slug == slug
            )
        ).all()
    )

    cutoff = _utcnow() - timedelta(minutes=older_than_minutes)
    rows = session.exec(
        select(EmbedConversation)
        .where(EmbedConversation.agent_slug == slug)
        .order_by(EmbedConversation.last_turn_at.asc())  # type: ignore[union-attr]
    ).all()

    # Walk every eligible row first so ``total`` reflects the true
    # backlog the cron is looking at, not just the page we return.
    # Operators read ``total`` from cron logs to spot backlog growth;
    # capping it at ``limit`` would silently mask a runaway queue.
    eligible: list[EmbedConversation] = []
    for r in rows:
        if r.id in classified_ids:
            continue
        # Active rows are only eligible once they've been quiet for the
        # cooldown — we don't want to classify a chat the visitor is
        # still typing into. SQLite round-trips datetimes as naive even
        # when we store them with tzinfo, so coerce both sides to aware
        # UTC before comparing or Python raises TypeError.
        if r.status == "active" and r.last_turn_at:
            last = r.last_turn_at
            if last.tzinfo is None:
                last = last.replace(tzinfo=UTC)
            if last > cutoff:
                continue
        # Empty rows (zero turns recorded) carry no signal.
        if r.turn_count <= 0:
            continue
        eligible.append(r)

    page = eligible[:limit]
    return PendingListOut(
        items=[PendingConversationOut(conversation=_serialize_full(r)) for r in page],
        total=len(eligible),
    )


# ---------------------------------------------------------------------------
# Mentor notes — trainer co-work (PR #34)
#
# Blajon proposes a capability ("Recognize 'piano' as specialty_transport").
# The Web app fans the proposal through the existing Living-Article review
# chain (Claude / Devin / Gemini). This module is the persistence layer:
# it records each round's verdict and lets the chat endpoint pull active
# (i.e. fully-reviewed-and-approved) notes at request time.
# ---------------------------------------------------------------------------


_MENTOR_NOTE_STATUSES = {
    "pending",
    "reviewing",
    "applied",
    "rejected",
    "retracted",
}
_MENTOR_NOTE_REVIEWERS = {"claude", "devin", "gemini"}
_MENTOR_NOTE_VERDICTS = {"approve", "reject"}


class ReviewRoundIn(BaseModel):
    reviewer_id: str = Field(..., min_length=1, max_length=32)
    verdict: str = Field(..., min_length=1, max_length=16)
    summary: str = Field(default="", max_length=600)
    body: str = Field(default="", max_length=8000)


class ReviewRoundOut(BaseModel):
    reviewer_id: str
    verdict: str
    summary: str
    body: str
    recorded_at: str


class ProposeMentorNoteIn(BaseModel):
    proposed_by_email: str = Field(..., min_length=3, max_length=200)
    proposed_text: str = Field(..., min_length=1, max_length=2000)
    source_insight_id: Optional[int] = None


class FinalizeMentorNoteIn(BaseModel):
    """Closes the review chain for a note.

    ``status`` must be ``applied`` or ``rejected``. When applying, a
    distinct ``applied_text`` may be supplied if the review chain
    tightened the phrasing; if omitted, ``proposed_text`` is used
    verbatim.
    """

    status: str = Field(..., pattern="^(applied|rejected)$")
    applied_text: Optional[str] = Field(default=None, max_length=2000)
    rejection_reason: Optional[str] = Field(default=None, max_length=600)


class MentorNoteOut(BaseModel):
    id: int
    agent_slug: str
    proposed_by_email: str
    proposed_at: str
    status: str
    proposed_text: str
    applied_text: str
    applied_at: Optional[str]
    reviewer_chain: list[ReviewRoundOut]
    source_insight_id: Optional[int]
    rejection_reason: str


class MentorNoteListOut(BaseModel):
    items: list[MentorNoteOut]
    total: int
    by_status: dict[str, int]


class ActiveMentorNoteOut(BaseModel):
    """Trimmed shape for the ``/active`` route — no PII, no review chain.

    The chat endpoint folds these straight into LuxAI1's system prompt, so
    we keep the payload as small as possible (lower latency + fewer
    tokens billed against Anthropic per turn).
    """

    id: int
    applied_text: str
    applied_at: Optional[str]


class ActiveMentorNotesOut(BaseModel):
    items: list[ActiveMentorNoteOut]


def _serialize_mentor_note(row: EmbedMentorNote) -> MentorNoteOut:
    chain_raw = _safe_load_json(row.reviewer_chain_json or "[]", [])
    rounds: list[ReviewRoundOut] = []
    if isinstance(chain_raw, list):
        for entry in chain_raw:
            if not isinstance(entry, dict):
                continue
            rounds.append(
                ReviewRoundOut(
                    reviewer_id=str(entry.get("reviewer_id") or ""),
                    verdict=str(entry.get("verdict") or ""),
                    summary=str(entry.get("summary") or ""),
                    body=str(entry.get("body") or ""),
                    recorded_at=str(entry.get("recorded_at") or ""),
                )
            )
    return MentorNoteOut(
        id=row.id or 0,
        agent_slug=row.agent_slug,
        proposed_by_email=row.proposed_by_email,
        proposed_at=row.proposed_at.isoformat() if row.proposed_at else "",
        status=row.status,
        proposed_text=row.proposed_text,
        applied_text=row.applied_text,
        applied_at=row.applied_at.isoformat() if row.applied_at else None,
        reviewer_chain=rounds,
        source_insight_id=row.source_insight_id,
        rejection_reason=row.rejection_reason,
    )


@router.post(
    "/{slug}/mentor-notes",
    response_model=MentorNoteOut,
    status_code=201,
    dependencies=[Depends(require_internal_auth)],
)
def propose_mentor_note(
    slug: str,
    payload: ProposeMentorNoteIn,
    session: Session = Depends(get_session),
) -> MentorNoteOut:
    """Record a new trainer-proposed capability at ``status="pending"``.

    The Web app calls this before kicking off the review chain so the
    proposal is visible in the trainer console even while reviews are
    still running. Subsequent review rounds advance the row in-place
    via ``/mentor-notes/{id}/round``.
    """
    if (
        payload.source_insight_id is not None
        and session.get(EmbedInsight, payload.source_insight_id) is None
    ):
        raise HTTPException(status_code=404, detail="source_insight_not_found")

    row = EmbedMentorNote(
        agent_slug=slug,
        proposed_by_email=payload.proposed_by_email.strip().lower(),
        proposed_text=payload.proposed_text.strip(),
        source_insight_id=payload.source_insight_id,
        status="pending",
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _serialize_mentor_note(row)


@router.post(
    "/mentor-notes/{note_id}/round",
    response_model=MentorNoteOut,
    dependencies=[Depends(require_internal_auth)],
)
def append_mentor_note_round(
    note_id: int,
    payload: ReviewRoundIn,
    session: Session = Depends(get_session),
) -> MentorNoteOut:
    """Append a single reviewer's verdict to a note's review chain.

    Idempotency: if a round from the same ``reviewer_id`` already exists,
    it is replaced in-place rather than appended. This makes the route
    safe to retry without polluting the chain with duplicate entries.

    Status side-effect: the first round flips ``pending`` → ``reviewing``.
    Finalization (``applied`` / ``rejected``) lives on a separate route
    so the orchestrator can decide based on the full chain.
    """
    if payload.reviewer_id not in _MENTOR_NOTE_REVIEWERS:
        raise HTTPException(
            status_code=422,
            detail=f"reviewer_id must be one of {sorted(_MENTOR_NOTE_REVIEWERS)}",
        )
    if payload.verdict not in _MENTOR_NOTE_VERDICTS:
        raise HTTPException(
            status_code=422,
            detail=f"verdict must be one of {sorted(_MENTOR_NOTE_VERDICTS)}",
        )
    row = session.get(EmbedMentorNote, note_id)
    if row is None:
        raise HTTPException(status_code=404, detail="mentor_note_not_found")
    if row.status in {"applied", "rejected", "retracted"}:
        raise HTTPException(
            status_code=409,
            detail=f"mentor_note_terminal_status: {row.status}",
        )

    chain = _safe_load_json(row.reviewer_chain_json or "[]", [])
    if not isinstance(chain, list):
        chain = []
    new_entry = {
        "reviewer_id": payload.reviewer_id,
        "verdict": payload.verdict,
        "summary": payload.summary,
        "body": payload.body,
        "recorded_at": _utcnow().isoformat(),
    }
    replaced = False
    for i, entry in enumerate(chain):
        if isinstance(entry, dict) and entry.get("reviewer_id") == payload.reviewer_id:
            chain[i] = new_entry
            replaced = True
            break
    if not replaced:
        chain.append(new_entry)

    row.reviewer_chain_json = json.dumps(chain)
    if row.status == "pending":
        row.status = "reviewing"
    session.add(row)
    session.commit()
    session.refresh(row)
    return _serialize_mentor_note(row)


@router.post(
    "/mentor-notes/{note_id}/finalize",
    response_model=MentorNoteOut,
    dependencies=[Depends(require_internal_auth)],
)
def finalize_mentor_note(
    note_id: int,
    payload: FinalizeMentorNoteIn,
    session: Session = Depends(get_session),
) -> MentorNoteOut:
    """Close out a note's review with a terminal status.

    The Web orchestrator calls this after the review chain has run end
    to end. Rejection requires at least one ``reject`` verdict in the
    chain; application requires every reviewer in
    ``_MENTOR_NOTE_REVIEWERS`` to have voted ``approve`` (the "trust
    the review chain" guarantee Dr. Cheteni signed off on for PR #34).

    Idempotent in the same direction: re-applying an already-applied
    note is a no-op (returns 200). Cross-direction transitions (e.g.
    apply → reject) are blocked with 409.
    """
    row = session.get(EmbedMentorNote, note_id)
    if row is None:
        raise HTTPException(status_code=404, detail="mentor_note_not_found")
    if row.status == payload.status:
        return _serialize_mentor_note(row)
    if row.status in {"applied", "rejected", "retracted"}:
        raise HTTPException(
            status_code=409,
            detail=f"mentor_note_terminal_status: {row.status}",
        )

    chain = _safe_load_json(row.reviewer_chain_json or "[]", [])
    if not isinstance(chain, list):
        chain = []
    verdicts: dict[str, str] = {}
    for entry in chain:
        if isinstance(entry, dict):
            rid = str(entry.get("reviewer_id") or "")
            v = str(entry.get("verdict") or "")
            if rid and v:
                verdicts[rid] = v

    if payload.status == "applied":
        missing = _MENTOR_NOTE_REVIEWERS - verdicts.keys()
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"mentor_note_missing_reviewers: {sorted(missing)}",
            )
        if any(v != "approve" for v in verdicts.values()):
            raise HTTPException(
                status_code=422,
                detail="mentor_note_has_rejection",
            )
        row.status = "applied"
        row.applied_text = (
            payload.applied_text.strip()
            if payload.applied_text and payload.applied_text.strip()
            else row.proposed_text
        )
        row.applied_at = _utcnow()
        row.rejection_reason = ""
    else:  # rejected
        if not any(v == "reject" for v in verdicts.values()):
            raise HTTPException(
                status_code=422,
                detail="mentor_note_no_rejection_in_chain",
            )
        row.status = "rejected"
        row.rejection_reason = (payload.rejection_reason or "").strip()[:600]
        row.applied_text = ""
        row.applied_at = None

    session.add(row)
    session.commit()
    session.refresh(row)
    return _serialize_mentor_note(row)


@router.post(
    "/mentor-notes/{note_id}/retract",
    response_model=MentorNoteOut,
    dependencies=[Depends(require_internal_auth)],
)
def retract_mentor_note(
    note_id: int,
    session: Session = Depends(get_session),
) -> MentorNoteOut:
    """Take an applied note out of the live system prompt.

    Distinct from rejection: rejection means the note never shipped;
    retraction means it shipped, the trainer learned something, and is
    pulling it back. Only ``applied`` notes can be retracted.
    """
    row = session.get(EmbedMentorNote, note_id)
    if row is None:
        raise HTTPException(status_code=404, detail="mentor_note_not_found")
    if row.status != "applied":
        raise HTTPException(
            status_code=409,
            detail=f"mentor_note_not_applied: {row.status}",
        )
    row.status = "retracted"
    session.add(row)
    session.commit()
    session.refresh(row)
    return _serialize_mentor_note(row)


@router.get(
    "/{slug}/mentor-notes",
    response_model=MentorNoteListOut,
    dependencies=[Depends(require_internal_auth)],
)
def list_mentor_notes(
    slug: str,
    status: Optional[str] = Query(default=None, max_length=16),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
) -> MentorNoteListOut:
    """Trainer-console list view: most-recent first, optionally filtered.

    ``by_status`` tallies the *full* set for the slug regardless of the
    page filter so the UI can render every chip count without a second
    round-trip — same idiom as ``list_insights``.
    """
    if status and status not in _MENTOR_NOTE_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"status must be one of {sorted(_MENTOR_NOTE_STATUSES)}",
        )

    page_query = select(EmbedMentorNote).where(EmbedMentorNote.agent_slug == slug)
    if status:
        page_query = page_query.where(EmbedMentorNote.status == status)
    rows = session.exec(
        page_query.order_by(
            EmbedMentorNote.proposed_at.desc()  # type: ignore[union-attr]
        )
        .offset(offset)
        .limit(limit)
    ).all()

    all_rows = session.exec(
        select(EmbedMentorNote).where(EmbedMentorNote.agent_slug == slug)
    ).all()
    by_status: dict[str, int] = {s: 0 for s in _MENTOR_NOTE_STATUSES}
    for r in all_rows:
        by_status[r.status] = by_status.get(r.status, 0) + 1

    return MentorNoteListOut(
        items=[_serialize_mentor_note(r) for r in rows],
        total=len(all_rows),
        by_status=by_status,
    )


@router.get(
    "/{slug}/mentor-notes/active",
    response_model=ActiveMentorNotesOut,
)
def list_active_mentor_notes(
    slug: str,
    session: Session = Depends(get_session),
) -> ActiveMentorNotesOut:
    """Public-read shortlist of notes the chat endpoint folds into the
    system prompt. No auth — the applied text is the agent's published
    voice; the trainer console (which exposes the full review chain
    and proposer email) is what's gated.

    Ordered by ``applied_at`` ascending so the trainer's most-trusted
    (oldest, most-tested) guidance lands first in the prompt and
    later additions stack underneath.
    """
    rows = session.exec(
        select(EmbedMentorNote)
        .where(EmbedMentorNote.agent_slug == slug)
        .where(EmbedMentorNote.status == "applied")
        .order_by(EmbedMentorNote.applied_at.asc())  # type: ignore[union-attr]
    ).all()
    items = [
        ActiveMentorNoteOut(
            id=r.id or 0,
            applied_text=r.applied_text,
            applied_at=r.applied_at.isoformat() if r.applied_at else None,
        )
        for r in rows
    ]
    return ActiveMentorNotesOut(items=items)
