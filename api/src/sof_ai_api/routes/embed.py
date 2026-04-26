"""Embed routes — conversations between visitors and embedded agents.

Backs the LuxAI1 → sof.ai training-data feedback loop. Every chat on
https://ai1.llc gets persisted here via an internal-only upsert from
the Web app's ``/api/embed/[slug]/chat`` route. Blajon and the lead
professors view conversations through Web pages that proxy here.

Surface:
  * POST /embed/conversations/upsert        — internal-auth, idempotent
  * GET  /embed/{slug}/conversations        — internal-auth, paginated
  * GET  /embed/conversations/{id}          — internal-auth, full transcript
  * POST /embed/conversations/cron/abandon  — internal-auth, mark stale active
"""
from __future__ import annotations

import json
from datetime import timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..db import get_session
from ..models import EmbedConversation, _utcnow
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
