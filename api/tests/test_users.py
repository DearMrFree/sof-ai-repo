"""Tests for the user-onboarding routes (PR-ONBOARDING).

Coverage:
  * POST /users/onboarding creates a profile, idempotent on email
  * Re-submitting the same email updates in place (not a new row)
  * Handle collision across distinct emails returns 409
  * Invalid user_type returns 400
  * GET /users supports ?type= filter and ?q= free-text search
  * counts_by_type is the FULL histogram (independent of filter) and
    seeds all 6 user types with 0 even when no rows exist
  * GET /users/admin/recent returns most-recent-first
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, delete

from sof_ai_api.db import engine, init_db
from sof_ai_api.main import app
from sof_ai_api.models import UserProfile
from sof_ai_api.settings import settings

# NOTE: do NOT set INTERNAL_API_KEY in os.environ at module-import time —
# the settings singleton reads the env once at first load, and depending
# on pytest's collection order that could leak the gate-on state into
# every other test module's TestClient. Instead the autouse fixture
# below toggles ``settings.internal_api_key`` directly with proper
# teardown so other modules see the gate restored to its pre-test state.

init_db()
client = TestClient(app)
AUTH = {"X-Internal-Auth": "test-internal-key"}


@pytest.fixture(autouse=True)
def _gate_and_wipe() -> object:
    """Enable internal-auth for these tests + restore on teardown so
    other test modules (e.g. test_applications) that assume the gate is
    OFF don't see our settings mutation leak across the session."""

    prior = settings.internal_api_key
    settings.internal_api_key = "test-internal-key"
    with Session(engine) as s:
        s.exec(delete(UserProfile))
        s.commit()
    yield
    settings.internal_api_key = prior
    with Session(engine) as s:
        s.exec(delete(UserProfile))
        s.commit()


def _payload(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "email": "ada@example.com",
        "handle": "ada",
        "display_name": "Ada Lovelace",
        "user_type": "student",
        "tagline": "First programmer.",
        "location": "London",
        "goals": ["Ship my first AI app", "Pair with Devin daily"],
        "strengths": ["Writing / docs", "Research"],
        "first_project": "Analytical engine notes, modernized.",
        "twin_name": "Ada-Twin",
        "twin_emoji": "✨",
        "twin_persona_seed": "Ada's twin: writes, researches, ships.",
        "devin_session_url": "",
    }
    base.update(overrides)
    return base


def test_create_then_update_is_idempotent_on_email() -> None:


    res = client.post("/users/onboarding", headers=AUTH, json=_payload())
    assert res.status_code == 200, res.text
    first = res.json()
    assert first["handle"] == "ada"
    assert first["user_type"] == "student"
    assert first["goals"] == ["Ship my first AI app", "Pair with Devin daily"]

    # Same email, different bio + handle — should update in place.
    res2 = client.post(
        "/users/onboarding",
        headers=AUTH,
        json=_payload(handle="ada-l", tagline="Updated tagline"),
    )
    assert res2.status_code == 200
    second = res2.json()
    assert second["id"] == first["id"]  # in-place update
    assert second["handle"] == "ada-l"
    assert second["tagline"] == "Updated tagline"


def test_handle_collision_across_emails_returns_409() -> None:


    client.post("/users/onboarding", headers=AUTH, json=_payload())
    other = _payload(email="different@example.com", handle="ada")
    res = client.post("/users/onboarding", headers=AUTH, json=other)
    assert res.status_code == 409, res.text


def test_invalid_user_type_returns_400() -> None:


    res = client.post(
        "/users/onboarding",
        headers=AUTH,
        json=_payload(user_type="wizard"),
    )
    assert res.status_code == 400


def test_list_filter_and_search() -> None:


    client.post("/users/onboarding", headers=AUTH, json=_payload())
    client.post(
        "/users/onboarding",
        headers=AUTH,
        json=_payload(
            email="grace@example.com",
            handle="grace",
            display_name="Grace Hopper",
            user_type="researcher",
        ),
    )
    client.post(
        "/users/onboarding",
        headers=AUTH,
        json=_payload(
            email="dean@example.com",
            handle="dean",
            display_name="Dean Apex",
            user_type="administrator",
        ),
    )

    # Filter by type.
    res = client.get("/users?type=researcher")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert [u["handle"] for u in body["items"]] == ["grace"]

    # Counts include all 6 types with 0-fills, AND reflect every row in
    # the DB regardless of the filter.
    counts = body["counts_by_type"]
    for t in ("student", "educator", "corporation", "administrator", "researcher", "founder"):
        assert t in counts
    assert counts["student"] == 1
    assert counts["administrator"] == 1
    assert counts["researcher"] == 1

    # Free-text search hits display_name, handle, AND tagline.
    res2 = client.get("/users?q=hopper")
    assert res2.json()["total"] == 1
    assert res2.json()["items"][0]["handle"] == "grace"


def test_admin_recent_returns_most_recent_first() -> None:


    client.post("/users/onboarding", headers=AUTH, json=_payload())
    client.post(
        "/users/onboarding",
        headers=AUTH,
        json=_payload(email="b@x.com", handle="bee"),
    )
    client.post(
        "/users/onboarding",
        headers=AUTH,
        json=_payload(email="c@x.com", handle="cee"),
    )

    res = client.get("/users/admin/recent?limit=2", headers=AUTH)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 3
    handles = [u["handle"] for u in body["items"]]
    assert handles == ["cee", "bee"]


def test_admin_recent_requires_internal_auth() -> None:


    # Without auth header, should fail.
    res = client.get("/users/admin/recent")
    assert res.status_code in (401, 403)


def test_search_escapes_like_wildcards() -> None:
    """Regression for Devin Review #38 — the ``q`` search param was
    interpolated into a LIKE pattern without escaping ``%``/``_``, so
    searching for ``%`` matched every row and ``_`` matched any single
    char. Confirm wildcards are now treated as literals."""
    client.post(
        "/users/onboarding",
        headers=AUTH,
        json=_payload(email="a@x.com", handle="ada", display_name="Ada"),
    )
    client.post(
        "/users/onboarding",
        headers=AUTH,
        json=_payload(
            email="b@x.com",
            handle="bee",
            display_name="Bee",
            tagline="100% bug-free",
        ),
    )
    client.post(
        "/users/onboarding",
        headers=AUTH,
        json=_payload(
            email="c@x.com",
            handle="cee",
            display_name="Cee",
            tagline="snake_case lover",
        ),
    )

    # Pre-fix: ``%`` would produce ``%%%`` and match all 3 rows.
    res = client.get("/users?q=%25")  # %25 = URL-encoded %
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1, body
    assert body["items"][0]["handle"] == "bee"

    # Pre-fix: ``_`` would match any single character (and thus every
    # tagline / handle that's non-empty). After fix only the literal
    # underscore in "snake_case" matches.
    res2 = client.get("/users?q=_")
    assert res2.status_code == 200
    body2 = res2.json()
    assert body2["total"] == 1, body2
    assert body2["items"][0]["handle"] == "cee"


def test_handle_normalization_strips_non_ascii() -> None:
    """Regression for Devin Review #38 — Python's ``str.isalnum`` accepts
    Unicode alphanumerics, so ``café`` would silently round-trip if we
    didn't ASCII-gate. Verify it's stripped down to ``caf``."""
    res = client.post(
        "/users/onboarding",
        headers=AUTH,
        json=_payload(email="cafe@example.com", handle="café"),
    )
    assert res.status_code == 200, res.text
    assert res.json()["handle"] == "caf"

    # And a fully non-ASCII handle should be rejected as invalid (empty
    # after stripping).
    res2 = client.post(
        "/users/onboarding",
        headers=AUTH,
        json=_payload(email="cyr@example.com", handle="имя"),
    )
    assert res2.status_code == 400


def test_goals_strengths_are_capped_and_round_tripped() -> None:


    big = [f"goal-{i}" for i in range(50)]
    res = client.post(
        "/users/onboarding",
        headers=AUTH,
        json=_payload(goals=big, strengths=big),
    )
    assert res.status_code == 200
    body = res.json()
    # Server caps at 20 to keep the list-encoded JSON column bounded.
    assert len(body["goals"]) == 20
    assert len(body["strengths"]) == 20


def test_signup_publishes_to_broker_with_public_payload() -> None:
    """Adversarial: a POST /users/onboarding must enqueue an SSE-formatted
    frame on the broker's subscriber queue with event=``profile.created``
    and a payload containing the handle but NOT the email.

    A regression where the upsert handler stops calling the broker would
    leave the queue empty (count==0); a regression where the payload
    leaks email would fail the ``email not in body`` assertion.
    """
    import asyncio as _asyncio
    import json as _json

    from sof_ai_api.routes._signups_broker import broker

    async def _drive() -> tuple[list[str], list[dict[str, object]]]:
        # Subscribe FIRST so the broker captures the running loop and
        # adds our queue before the publish lands.
        q = await broker.subscribe()
        try:
            # Run the sync TestClient call on a worker thread (mirrors how
            # FastAPI runs sync request handlers IRL — the publish then
            # round-trips back via run_coroutine_threadsafe).
            await _asyncio.to_thread(
                lambda: client.post(
                    "/users/onboarding", headers=AUTH, json=_payload()
                )
            )
            await _asyncio.to_thread(
                lambda: client.post(
                    "/users/onboarding",
                    headers=AUTH,
                    json=_payload(tagline="updated"),
                )
            )
            frames: list[str] = []
            for _ in range(2):
                frame = await _asyncio.wait_for(q.get(), timeout=3.0)
                frames.append(frame)
            payloads: list[dict[str, object]] = []
            event_names: list[str] = []
            for f in frames:
                # frame format: "event: <name>\ndata: <json>\n\n"
                lines = f.strip().split("\n")
                event_names.append(lines[0].removeprefix("event: ").strip())
                data = lines[1].removeprefix("data: ")
                payloads.append(_json.loads(data))
            return event_names, payloads
        finally:
            await broker.unsubscribe(q)

    event_names, payloads = _asyncio.run(_drive())
    assert event_names == ["profile.created", "profile.updated"], event_names
    assert all(p.get("handle") == "ada" for p in payloads), payloads
    # Email is deliberately stripped from the public SSE payload.
    assert all("email" not in p for p in payloads), payloads


def test_admin_stream_requires_internal_auth() -> None:
    """Without the auth header OR ``?auth=`` query, the stream 401s.

    Adversarial: the gate has both a header path and a query-string
    path; we hit the endpoint with neither and expect 401.
    """
    # Use a streaming GET so FastAPI doesn't try to read the whole body
    # before honoring the HTTPException raised at handler entry.
    with client.stream("GET", "/users/admin/stream") as r:
        assert r.status_code == 401


def test_multiplex_yields_queue_frame_when_heartbeat_fires_concurrently() -> None:
    """Adversarial regression for the SSE data-loss bug Devin Review caught
    on PR #40 (line 477).

    Setup: zero-second heartbeat. Each loop iteration of
    ``_multiplex_queue_with_heartbeat`` will see the heartbeat task as
    already-done. We pre-fill the queue with two frames and run for a
    short window. The OLD code branched into the heartbeat path first,
    ``continue``-d past the dequeued frame, and silently lost it — so
    the test would only see ``:hb`` lines and never the data frames.
    The FIX yields the frame even when both tasks completed in the
    same ``asyncio.wait`` round, so we MUST observe both frames.

    A regression that re-introduces the mutually-exclusive branching
    will produce zero data frames here (only heartbeats).
    """
    import asyncio as _asyncio

    from sof_ai_api.routes.users import _multiplex_queue_with_heartbeat

    async def _drive() -> list[str]:
        q: _asyncio.Queue[str] = _asyncio.Queue()
        await q.put("event: profile.created\ndata: {\"id\":1}\n\n")
        await q.put("event: profile.created\ndata: {\"id\":2}\n\n")

        async def _never_disconnect() -> bool:
            return False

        out: list[str] = []
        # heartbeat=0 forces the both-tasks-done race on every iteration.
        agen = _multiplex_queue_with_heartbeat(
            q, _never_disconnect, heartbeat_seconds=0.0
        )
        try:
            # Pull a bounded number of chunks to avoid an infinite hb loop.
            for _ in range(20):
                chunk = await _asyncio.wait_for(agen.__anext__(), timeout=1.0)
                out.append(chunk)
                # Stop once we've seen both data frames.
                data_seen = sum(
                    1 for c in out if c.startswith("event: profile.")
                )
                if data_seen >= 2:
                    break
        finally:
            await agen.aclose()
        return out

    chunks = _asyncio.run(_drive())
    data_chunks = [c for c in chunks if c.startswith("event: profile.")]
    assert len(data_chunks) == 2, f"Expected both frames; got {chunks}"
    assert "\"id\":1" in data_chunks[0]
    assert "\"id\":2" in data_chunks[1]
