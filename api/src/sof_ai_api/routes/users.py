"""
User profiles + onboarding — the persistence layer behind ``/welcome`` and
``/u`` directory search.

Every signup produces one ``UserProfile`` row keyed by email. The 6 onboarding
answers are stored alongside the user_type (which drives the searchable
filter on ``/u`` and the admin dashboard's per-type live counts) and the
seed for the user's personal AI twin (which is later evolved through the
existing trainer co-work loop).

Routes:
- ``POST /users/onboarding`` (internal-auth) — upsert by email
- ``GET /users/{email}`` — single profile (public; nothing here is secret)
- ``GET /users`` — list, with optional ``?type=`` and ``?q=`` filters
- ``GET /users/admin/recent`` — last N (admin dashboard SSE seed)
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, or_, select

from ..db import get_session
from ..models import UserProfile, _utcnow
from ._signups_broker import broker, publish_signup_threadsafe, subscription
from .wallet import require_internal_auth

router = APIRouter(prefix="/users", tags=["users"])


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

UserType = Literal[
    "student",
    "educator",
    "corporation",
    "administrator",
    "researcher",
    "founder",
]

USER_TYPES: frozenset[str] = frozenset(
    ("student", "educator", "corporation", "administrator", "researcher", "founder")
)

LIST_LIMIT_DEFAULT = 50
LIST_LIMIT_MAX = 200


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class OnboardingIn(BaseModel):
    """The 6 wizard answers + identity fields.

    ``email`` is the natural key. The rest map 1:1 to UserProfile columns
    except ``goals``/``strengths`` which are arrays serialized to JSON
    text on insert (SQLite has no JSON type).
    """

    email: str = Field(max_length=200)
    handle: str = Field(max_length=64)
    display_name: str = Field(max_length=200)
    user_type: str = Field(max_length=32)
    tagline: str = Field(default="", max_length=300)
    location: str = Field(default="", max_length=200)
    goals: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    first_project: str = Field(default="", max_length=500)
    twin_name: str = Field(default="", max_length=80)
    twin_emoji: str = Field(default="🤖", max_length=8)
    twin_persona_seed: str = Field(default="")
    devin_session_url: str = Field(default="", max_length=500)


class UserProfileOut(BaseModel):
    """Read shape — array fields are decoded back to lists."""

    id: int
    email: str
    handle: str
    display_name: str
    user_type: str
    tagline: str
    location: str
    goals: list[str]
    strengths: list[str]
    first_project: str
    twin_name: str
    twin_emoji: str
    twin_persona_seed: str
    devin_session_url: str
    created_at: str
    updated_at: str

    @classmethod
    def from_row(cls, row: UserProfile) -> UserProfileOut:
        try:
            goals = json.loads(row.goals_json) if row.goals_json else []
            if not isinstance(goals, list):
                goals = []
        except (json.JSONDecodeError, TypeError):
            goals = []
        try:
            strengths = json.loads(row.strengths_json) if row.strengths_json else []
            if not isinstance(strengths, list):
                strengths = []
        except (json.JSONDecodeError, TypeError):
            strengths = []
        return cls(
            id=row.id or 0,
            email=row.email,
            handle=row.handle,
            display_name=row.display_name,
            user_type=row.user_type,
            tagline=row.tagline,
            location=row.location,
            goals=goals,
            strengths=strengths,
            first_project=row.first_project,
            twin_name=row.twin_name,
            twin_emoji=row.twin_emoji,
            twin_persona_seed=row.twin_persona_seed,
            devin_session_url=row.devin_session_url,
            created_at=row.created_at.isoformat(),
            updated_at=row.updated_at.isoformat(),
        )


class UserProfileListOut(BaseModel):
    items: list[UserProfileOut]
    total: int
    counts_by_type: dict[str, int]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalize_email(email: str) -> str:
    e = (email or "").strip().lower()
    if "@" not in e:
        raise HTTPException(status_code=400, detail="invalid email")
    return e


def _normalize_handle(handle: str) -> str:
    h = (handle or "").strip().lstrip("@").lower()
    # Allow ASCII [a-z0-9._-] only. Note: ``c.isalnum()`` on Python 3 also
    # accepts non-ASCII alphanumerics (é, ñ, 中, Ω, Arabic digits, …),
    # which would let handles like ``café`` or homograph attacks (Cyrillic
    # ``а`` vs Latin ``a``) into URLs at /u/{handle}. Gate on isascii()
    # too so the handle space stays predictable + URL-safe.
    safe = "".join(c for c in h if (c.isascii() and c.isalnum()) or c in "._-")
    if not safe or len(safe) > 64:
        raise HTTPException(status_code=400, detail="invalid handle")
    return safe


def _validate_user_type(user_type: str) -> str:
    t = (user_type or "").strip().lower()
    if t not in USER_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"user_type must be one of: {sorted(USER_TYPES)}",
        )
    return t


def _public_signup_payload(out: UserProfileOut) -> dict[str, Any]:
    """Trim the SSE payload to public-safe fields.

    Email is **deliberately** stripped — the SSE stream is intended for
    operators (admins) but the principle of least exposure says we
    should only ship what the dashboard actually renders. Anything
    extra here would leak through to anyone who manages to scrape the
    proxy. The dashboard renders handle / display_name / user_type /
    twin so that's what we publish.
    """

    return {
        "id": out.id,
        "handle": out.handle,
        "display_name": out.display_name,
        "user_type": out.user_type,
        "tagline": out.tagline,
        "twin_name": out.twin_name,
        "twin_emoji": out.twin_emoji,
        "created_at": out.created_at,
        "updated_at": out.updated_at,
    }


def _publish_signup_event(event_name: str, out: UserProfileOut) -> None:
    """Best-effort publish — never blocks or raises into the request path.

    The onboarding upsert handler is a sync def (SQLModel sessions are
    sync), so FastAPI runs it on an anyio worker thread. The broker
    captured the running event loop on its first subscription; we use
    that reference to schedule the publish coroutine. If no subscriber
    has ever connected, ``loop`` is None and the publish is a no-op.
    """

    publish_signup_threadsafe(broker.loop, event_name, _public_signup_payload(out))


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/onboarding", response_model=UserProfileOut)
def upsert_onboarding(
    body: OnboardingIn,
    session: Session = Depends(get_session),
    _auth: None = Depends(require_internal_auth),
) -> UserProfileOut:
    """Upsert a user profile by email.

    Idempotent — re-submitting the wizard updates the row in place rather
    than failing with a unique-constraint violation. Handle collisions
    across distinct emails surface as HTTP 409 (the user must pick a
    different handle).
    """

    email = _normalize_email(body.email)
    handle = _normalize_handle(body.handle)
    user_type = _validate_user_type(body.user_type)

    existing = session.exec(
        select(UserProfile).where(UserProfile.email == email)
    ).first()

    # Handle collision check — only if changing or first-time insert.
    if not existing or existing.handle != handle:
        clash = session.exec(
            select(UserProfile).where(UserProfile.handle == handle)
        ).first()
        if clash and (not existing or clash.id != existing.id):
            raise HTTPException(status_code=409, detail="handle taken")

    goals_json = json.dumps(body.goals[:20])  # soft cap
    strengths_json = json.dumps(body.strengths[:20])

    if existing:
        existing.handle = handle
        existing.display_name = body.display_name.strip()[:200]
        existing.user_type = user_type
        existing.tagline = body.tagline.strip()[:300]
        existing.location = body.location.strip()[:200]
        existing.goals_json = goals_json
        existing.strengths_json = strengths_json
        existing.first_project = body.first_project.strip()[:500]
        existing.twin_name = body.twin_name.strip()[:80]
        existing.twin_emoji = body.twin_emoji.strip()[:8] or "🤖"
        existing.twin_persona_seed = body.twin_persona_seed
        existing.devin_session_url = body.devin_session_url.strip()[:500]
        existing.updated_at = _utcnow()
        session.add(existing)
        try:
            session.commit()
        except IntegrityError as e:
            session.rollback()
            raise HTTPException(status_code=409, detail="handle taken") from e
        session.refresh(existing)
        out = UserProfileOut.from_row(existing)
        _publish_signup_event("profile.updated", out)
        return out

    row = UserProfile(
        email=email,
        handle=handle,
        display_name=body.display_name.strip()[:200],
        user_type=user_type,
        tagline=body.tagline.strip()[:300],
        location=body.location.strip()[:200],
        goals_json=goals_json,
        strengths_json=strengths_json,
        first_project=body.first_project.strip()[:500],
        twin_name=body.twin_name.strip()[:80],
        twin_emoji=body.twin_emoji.strip()[:8] or "🤖",
        twin_persona_seed=body.twin_persona_seed,
        devin_session_url=body.devin_session_url.strip()[:500],
    )
    session.add(row)
    try:
        session.commit()
    except IntegrityError as e:
        session.rollback()
        raise HTTPException(status_code=409, detail="email or handle taken") from e
    session.refresh(row)
    out = UserProfileOut.from_row(row)
    _publish_signup_event("profile.created", out)
    return out


@router.get("/{email}", response_model=UserProfileOut)
def get_user(
    email: str, session: Session = Depends(get_session)
) -> UserProfileOut:
    e = _normalize_email(email)
    row = session.exec(select(UserProfile).where(UserProfile.email == e)).first()
    if not row:
        raise HTTPException(status_code=404, detail="user not found")
    return UserProfileOut.from_row(row)


@router.get("/by-handle/{handle}", response_model=UserProfileOut)
def get_user_by_handle(
    handle: str, session: Session = Depends(get_session)
) -> UserProfileOut:
    h = _normalize_handle(handle)
    row = session.exec(select(UserProfile).where(UserProfile.handle == h)).first()
    if not row:
        raise HTTPException(status_code=404, detail="user not found")
    return UserProfileOut.from_row(row)


@router.get("", response_model=UserProfileListOut)
def list_users(
    type: Optional[str] = Query(default=None, description="Filter by user_type"),
    q: Optional[str] = Query(default=None, description="Search name/handle/tagline"),
    limit: int = Query(default=LIST_LIMIT_DEFAULT, ge=1, le=LIST_LIMIT_MAX),
    session: Session = Depends(get_session),
) -> UserProfileListOut:
    """List user profiles with optional filter + free-text search.

    Returns ``counts_by_type`` keyed by user_type so the directory page can
    render type tab counts without a second roundtrip. ``total`` is the
    full eligible set after filters (NOT capped at ``limit``) so callers
    can render "showing N of M".
    """

    base = select(UserProfile)
    if type:
        base = base.where(UserProfile.user_type == _validate_user_type(type))
    if q:
        # Escape SQL LIKE metacharacters in user input. SQLAlchemy
        # parameterizes the value (so no injection), but ``%`` and ``_``
        # are still interpreted as wildcards by the engine — searching
        # for ``%`` would otherwise produce ``%%%`` and match every row;
        # ``_`` would match any single-character string. Use a non-SQL
        # escape char (``\``) and tell ilike() about it explicitly.
        cleaned = (
            q.strip().lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        like = f"%{cleaned}%"
        base = base.where(
            or_(
                col(UserProfile.display_name).ilike(like, escape="\\"),
                col(UserProfile.handle).ilike(like, escape="\\"),
                col(UserProfile.tagline).ilike(like, escape="\\"),
            )
        )

    eligible = session.exec(base).all()
    total = len(eligible)
    items = list(
        sorted(eligible, key=lambda r: r.created_at, reverse=True)[:limit]
    )

    # Always compute the full per-type histogram for the tabs (independent
    # of the filter so tab counts don't collapse to 0 after picking a tab).
    all_rows = session.exec(select(UserProfile)).all()
    counts: dict[str, int] = {}
    for r in all_rows:
        counts[r.user_type] = counts.get(r.user_type, 0) + 1
    for t in USER_TYPES:
        counts.setdefault(t, 0)

    return UserProfileListOut(
        items=[UserProfileOut.from_row(r) for r in items],
        total=total,
        counts_by_type=counts,
    )


@router.get("/admin/recent", response_model=UserProfileListOut)
def list_recent(
    limit: int = Query(default=20, ge=1, le=200),
    session: Session = Depends(get_session),
    _auth: None = Depends(require_internal_auth),
) -> UserProfileListOut:
    """Admin-only feed of the most recent signups.

    Backs the real-time admin dashboard. Internal-auth gated so the
    public Fly endpoint can't be scraped for emails.
    """

    rows = session.exec(
        select(UserProfile).order_by(col(UserProfile.created_at).desc()).limit(limit)
    ).all()
    total = session.exec(select(UserProfile)).all()

    counts: dict[str, int] = {}
    for r in total:
        counts[r.user_type] = counts.get(r.user_type, 0) + 1
    for t in USER_TYPES:
        counts.setdefault(t, 0)

    return UserProfileListOut(
        items=[UserProfileOut.from_row(r) for r in rows],
        total=len(total),
        counts_by_type=counts,
    )


# ---------------------------------------------------------------------------
# Real-time admin stream
# ---------------------------------------------------------------------------


@router.get("/admin/stream")
async def admin_signup_stream(
    request: Request,
    auth: Optional[str] = Query(default=None, description="Internal auth token"),
) -> StreamingResponse:
    """Server-Sent Events stream of new-signup events.

    Browsers can't add custom headers to ``EventSource`` requests, so the
    internal auth token is also accepted as a ``?auth=`` query string
    here. The web-side proxy sets it from a server-side env var so the
    token never leaves the trusted process.

    Emits:
    - ``profile.created`` — payload is ``_public_signup_payload(...)``
    - ``profile.updated`` — same shape (re-onboarding by same email)

    Plus periodic ``:hb`` comment lines every 15s for keep-alive.
    """

    # ---- Auth (header OR query). ----
    # Mirrors the require_internal_auth() gate: empty ``internal_api_key``
    # disables the gate (used by local dev + the pytest TestClient suite).
    # Otherwise the supplied token must match exactly.
    expected = _expected_internal_auth_token()
    if expected:
        header_token = request.headers.get("X-Internal-Auth")
        supplied = header_token or auth or ""
        if supplied != expected:
            raise HTTPException(status_code=401, detail="unauthorized")

    async def event_generator():
        # Open the channel.
        yield ":connected\n\n"
        async with subscription() as q:
            heartbeat_task = asyncio.create_task(_sleep_seconds(15.0))
            try:
                while True:
                    if await request.is_disconnected():
                        break
                    get_task = asyncio.create_task(q.get())
                    done, _pending = await asyncio.wait(
                        {get_task, heartbeat_task},
                        return_when=asyncio.FIRST_COMPLETED,
                        timeout=None,
                    )
                    if heartbeat_task in done:
                        # Reset heartbeat clock.
                        heartbeat_task = asyncio.create_task(_sleep_seconds(15.0))
                        if get_task not in done:
                            get_task.cancel()
                        yield ":hb\n\n"
                        continue
                    if get_task in done:
                        frame = get_task.result()
                        yield frame
            finally:
                heartbeat_task.cancel()

    headers = {
        # Browsers will reconnect after 3s by default. Tell intermediaries
        # not to buffer (Cloudflare/Vercel) and not to cache.
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=headers,
    )


async def _sleep_seconds(seconds: float) -> None:
    await asyncio.sleep(seconds)


def _expected_internal_auth_token() -> str:
    """Read the same token ``require_internal_auth`` checks against.

    Inlined here so the SSE handler can fall back to ``?auth=`` (browsers
    can't set headers on EventSource) without going through a Depends
    that would 401 before we reach the query-string fallback.
    """

    from ..settings import settings

    return getattr(settings, "internal_api_key", "") or ""
