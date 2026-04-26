"""Routes for digital twins.

A "digital twin" is a per-user AI persona seeded from the ``/welcome``
wizard answers (``twin_name``, ``twin_emoji``, ``twin_persona_seed``,
``goals``, ``strengths``, ``first_project``, ``user_type``). The twin
itself is not a separate database row — those fields already live on
``UserProfile`` — but each owner can train new "skills" into their
twin via :class:`~sof_ai_api.models.TwinSkill` rows.

Each proposed skill flows through the same Claude/Devin/Gemini review
chain we built for trainer co-work on LuxAI1 (PR #34/#35). Only the
owner of the profile (matched by email) can propose or retract; reads
are public so every visitor sees what the twin has been trained on.

Routes:
  ``POST /twins/by-handle/{handle}/skills``
      Owner proposes a new skill. Creates the row at
      ``status="pending"``; the Web app then drives reviewer rounds
      via ``/round`` and finalizes via ``/finalize``.
  ``POST /twins/skills/{skill_id}/round``
      Append/replace a single reviewer's verdict.
  ``POST /twins/skills/{skill_id}/finalize``
      Flip status to ``applied`` or ``rejected``.
  ``POST /twins/skills/{skill_id}/retract``
      Owner retracts an applied skill — twin stops emitting it.
  ``GET /twins/by-handle/{handle}/skills``
      All non-retracted skills (any status). Public read.
  ``GET /twins/by-handle/{handle}/skills/active``
      Just the ``applied`` skills, oldest-first so persona injection
      is stable across requests. Public read; this is what the chat
      route would fold into the twin's system prompt.
  ``GET /twins/by-handle/{handle}``
      Twin summary — name, emoji, persona seed, applied skills.
      Public read; powers the "AI twin" section on /u/{handle}.
"""
from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..db import get_session
from ..models import TwinSkill, UserProfile
from .wallet import require_internal_auth

router = APIRouter(prefix="/twins", tags=["twins"])

_SKILL_REVIEWERS = {"claude", "devin", "gemini"}
_SKILL_VERDICTS = {"approve", "reject"}
_TERMINAL_STATUSES = {"applied", "rejected", "retracted"}


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _safe_load_json(raw: str, fallback: object) -> object:
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return fallback


class ReviewRoundIn(BaseModel):
    reviewer_id: str
    verdict: str
    summary: str = ""
    body: str = ""


class ReviewRoundOut(BaseModel):
    reviewer_id: str
    verdict: str
    summary: str
    body: str
    recorded_at: str


class ProposeSkillIn(BaseModel):
    proposed_by_email: str = Field(min_length=3, max_length=200)
    title: str = Field(default="", max_length=120)
    proposed_text: str = Field(min_length=1, max_length=2000)


class FinalizeSkillIn(BaseModel):
    status: str  # "applied" | "rejected"
    rejection_reason: str = ""


class TwinSkillOut(BaseModel):
    """Public-read view of a TwinSkill row.

    Intentionally omits ``proposed_by_email`` — the proposer is always
    the profile owner, whose email is private. Storing it on the row
    is for audit; surfacing it on a public endpoint would leak PII to
    every visitor of /u/{handle}.
    """

    id: int
    user_profile_id: int
    handle: str
    proposed_at: str
    status: str
    title: str
    proposed_text: str
    applied_text: str
    applied_at: Optional[str]
    reviewer_chain: list[ReviewRoundOut]
    rejection_reason: str


class TwinSkillsListOut(BaseModel):
    items: list[TwinSkillOut]
    total: int


class TwinSummaryOut(BaseModel):
    handle: str
    display_name: str
    user_type: str
    twin_name: str
    twin_emoji: str
    twin_persona_seed: str
    goals: list[str]
    strengths: list[str]
    first_project: str
    applied_skills: list[TwinSkillOut]


def _serialize_skill(row: TwinSkill, handle: str) -> TwinSkillOut:
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
    return TwinSkillOut(
        id=row.id or 0,
        user_profile_id=row.user_profile_id,
        handle=handle,
        proposed_at=row.proposed_at.isoformat() if row.proposed_at else "",
        status=row.status,
        title=row.title,
        proposed_text=row.proposed_text,
        applied_text=row.applied_text,
        applied_at=row.applied_at.isoformat() if row.applied_at else None,
        reviewer_chain=rounds,
        rejection_reason=row.rejection_reason,
    )


def _profile_by_handle(session: Session, handle: str) -> UserProfile:
    norm = handle.strip().lower()
    if not norm:
        raise HTTPException(status_code=404, detail="profile_not_found")
    row = session.exec(
        select(UserProfile).where(UserProfile.handle == norm)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="profile_not_found")
    return row


@router.post(
    "/by-handle/{handle}/skills",
    response_model=TwinSkillOut,
    status_code=201,
    dependencies=[Depends(require_internal_auth)],
)
def propose_skill(
    handle: str,
    payload: ProposeSkillIn,
    session: Session = Depends(get_session),
) -> TwinSkillOut:
    """Owner proposes a new skill for their twin.

    Owner check: ``proposed_by_email`` must match the profile's email
    (case-insensitive). The Web app fills this from the server-side
    NextAuth session, so a client cannot impersonate another user.
    """
    profile = _profile_by_handle(session, handle)
    proposer = payload.proposed_by_email.strip().lower()
    if proposer != profile.email.strip().lower():
        raise HTTPException(status_code=403, detail="not_owner")

    text = payload.proposed_text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="proposed_text_required")
    title = payload.title.strip()[:120]

    row = TwinSkill(
        user_profile_id=profile.id or 0,
        proposed_by_email=proposer,
        status="pending",
        title=title,
        proposed_text=text,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _serialize_skill(row, profile.handle)


@router.post(
    "/skills/{skill_id}/round",
    response_model=TwinSkillOut,
    dependencies=[Depends(require_internal_auth)],
)
def append_round(
    skill_id: int,
    payload: ReviewRoundIn,
    session: Session = Depends(get_session),
) -> TwinSkillOut:
    """Append (or replace) a single reviewer's verdict on a skill.

    Idempotent on ``reviewer_id`` so retries don't duplicate rounds.
    First round flips ``pending`` → ``reviewing``.
    """
    if payload.reviewer_id not in _SKILL_REVIEWERS:
        raise HTTPException(
            status_code=422,
            detail=f"reviewer_id must be one of {sorted(_SKILL_REVIEWERS)}",
        )
    if payload.verdict not in _SKILL_VERDICTS:
        raise HTTPException(
            status_code=422,
            detail=f"verdict must be one of {sorted(_SKILL_VERDICTS)}",
        )
    row = session.get(TwinSkill, skill_id)
    if row is None:
        raise HTTPException(status_code=404, detail="skill_not_found")
    if row.status in _TERMINAL_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"skill_terminal_status: {row.status}",
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
    for idx, existing in enumerate(chain):
        if isinstance(existing, dict) and existing.get("reviewer_id") == payload.reviewer_id:
            chain[idx] = new_entry
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

    profile = session.get(UserProfile, row.user_profile_id)
    return _serialize_skill(row, profile.handle if profile else "")


@router.post(
    "/skills/{skill_id}/finalize",
    response_model=TwinSkillOut,
    dependencies=[Depends(require_internal_auth)],
)
def finalize_skill(
    skill_id: int,
    payload: FinalizeSkillIn,
    session: Session = Depends(get_session),
) -> TwinSkillOut:
    """Flip the skill to ``applied`` or ``rejected`` based on the chain."""
    if payload.status not in {"applied", "rejected"}:
        raise HTTPException(
            status_code=422,
            detail="status must be 'applied' or 'rejected'",
        )
    row = session.get(TwinSkill, skill_id)
    if row is None:
        raise HTTPException(status_code=404, detail="skill_not_found")
    if row.status in _TERMINAL_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"skill_terminal_status: {row.status}",
        )

    if payload.status == "applied":
        row.status = "applied"
        row.applied_text = row.proposed_text
        row.applied_at = _utcnow()
        row.rejection_reason = ""
    else:
        row.status = "rejected"
        row.rejection_reason = payload.rejection_reason.strip()[:600]
    session.add(row)
    session.commit()
    session.refresh(row)
    profile = session.get(UserProfile, row.user_profile_id)
    return _serialize_skill(row, profile.handle if profile else "")


@router.post(
    "/skills/{skill_id}/retract",
    response_model=TwinSkillOut,
    dependencies=[Depends(require_internal_auth)],
)
def retract_skill(
    skill_id: int,
    payload: ProposeSkillIn,  # we reuse ProposeSkillIn for the email field
    session: Session = Depends(get_session),
) -> TwinSkillOut:
    """Owner retracts an applied (or pending) skill.

    Note: ``ProposeSkillIn`` is reused as the request body for owner
    verification only — its ``proposed_text`` is ignored on retract.
    """
    row = session.get(TwinSkill, skill_id)
    if row is None:
        raise HTTPException(status_code=404, detail="skill_not_found")
    profile = session.get(UserProfile, row.user_profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="profile_not_found")
    requester = payload.proposed_by_email.strip().lower()
    if requester != profile.email.strip().lower():
        raise HTTPException(status_code=403, detail="not_owner")
    if row.status == "retracted":
        raise HTTPException(status_code=409, detail="already_retracted")
    row.status = "retracted"
    session.add(row)
    session.commit()
    session.refresh(row)
    return _serialize_skill(row, profile.handle)


@router.get(
    "/by-handle/{handle}/skills",
    response_model=TwinSkillsListOut,
)
def list_skills(
    handle: str,
    session: Session = Depends(get_session),
) -> TwinSkillsListOut:
    """Public read: every non-retracted skill for the twin."""
    profile = _profile_by_handle(session, handle)
    rows = session.exec(
        select(TwinSkill)
        .where(TwinSkill.user_profile_id == profile.id)
        .where(TwinSkill.status != "retracted")
        .order_by(TwinSkill.proposed_at.desc())
    ).all()
    items = [_serialize_skill(r, profile.handle) for r in rows]
    return TwinSkillsListOut(items=items, total=len(items))


@router.get(
    "/by-handle/{handle}/skills/active",
    response_model=TwinSkillsListOut,
)
def list_active_skills(
    handle: str,
    session: Session = Depends(get_session),
) -> TwinSkillsListOut:
    """Public read: just ``applied`` skills, oldest-first.

    Stable ordering matters: the consumer (chat route, persona
    builder) folds ``applied_text`` of each row into the twin's
    system prompt; randomizing order would invalidate any reasoning
    cache the LLM provider keeps and can confuse later instructions.
    """
    profile = _profile_by_handle(session, handle)
    rows = session.exec(
        select(TwinSkill)
        .where(TwinSkill.user_profile_id == profile.id)
        .where(TwinSkill.status == "applied")
        .order_by(TwinSkill.applied_at.asc())
    ).all()
    items = [_serialize_skill(r, profile.handle) for r in rows]
    return TwinSkillsListOut(items=items, total=len(items))


@router.get(
    "/by-handle/{handle}",
    response_model=TwinSummaryOut,
)
def get_twin(
    handle: str,
    session: Session = Depends(get_session),
) -> TwinSummaryOut:
    """Public read: assembled twin summary + applied skills.

    Powers the "AI twin" section on ``/u/{handle}``. Note that we
    intentionally DO NOT include the owner's email in this response —
    the twin is a public face of the profile (least-exposure principle,
    same rationale as the SSE payload trim in PR #40).
    """
    profile = _profile_by_handle(session, handle)
    goals = _safe_load_json(profile.goals_json or "[]", [])
    strengths = _safe_load_json(profile.strengths_json or "[]", [])
    rows = session.exec(
        select(TwinSkill)
        .where(TwinSkill.user_profile_id == profile.id)
        .where(TwinSkill.status == "applied")
        .order_by(TwinSkill.applied_at.asc())
    ).all()
    return TwinSummaryOut(
        handle=profile.handle,
        display_name=profile.display_name,
        user_type=profile.user_type,
        twin_name=profile.twin_name or f"{profile.display_name}'s twin",
        twin_emoji=profile.twin_emoji or "🤖",
        twin_persona_seed=profile.twin_persona_seed,
        goals=[str(g) for g in goals] if isinstance(goals, list) else [],
        strengths=[str(s) for s in strengths] if isinstance(strengths, list) else [],
        first_project=profile.first_project,
        applied_skills=[_serialize_skill(r, profile.handle) for r in rows],
    )
