"""Tests for the embed-insights routes.

Coverage:
  * POST /embed/insights/upsert creates a row, validates type, links to convo
  * Re-upsert on same conversation_id replaces in-place (idempotent)
  * GET /embed/{slug}/insights ranks by signal_score desc, filters by type
  * GET /embed/{slug}/insights/pending excludes already-classified rows
  * Pending excludes still-active rows under the cooldown
  * All routes require X-Internal-Auth
"""
from __future__ import annotations

import os
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from sof_ai_api.db import engine, init_db
from sof_ai_api.main import app
from sof_ai_api.models import EmbedConversation, EmbedInsight, _utcnow
from sof_ai_api.settings import settings

os.environ.setdefault("INTERNAL_API_KEY", "test-internal-key")
init_db()
client = TestClient(app)
AUTH = {"X-Internal-Auth": "test-internal-key"}


class _AuthGate:
    """Forces the internal-auth gate to be enforced for the duration."""

    def __enter__(self) -> None:
        self._prior = settings.internal_api_key
        settings.internal_api_key = "test-internal-key"

    def __exit__(self, *_exc: object) -> None:
        settings.internal_api_key = self._prior


def _make_conversation(
    thread_id: str,
    *,
    status: str = "converted",
    last_turn_offset: timedelta = timedelta(minutes=10),
    turn_count: int = 4,
    transcript: str | None = None,
) -> int:
    """Insert a conversation directly via the model and return its id."""
    with Session(engine) as session:
        c = EmbedConversation(
            agent_slug="luxai1",
            client_thread_id=thread_id,
            owner_email="luxservicesbayarea@gmail.com",
            turn_count=turn_count,
            lead_submitted=(status == "converted"),
            status=status,
            transcript_json=transcript
            or '[{"role":"user","content":"Need a piano move."}]',
            last_turn_at=_utcnow() - last_turn_offset,
        )
        session.add(c)
        session.commit()
        session.refresh(c)
        assert c.id is not None
        return c.id


def _insight_payload(
    conversation_id: int,
    *,
    insight_type: str = "missed_lead",
    signal_score: float = 0.7,
    summary: str = "Visitor asked about piano move pricing; bot deflected without capturing lead.",
    suggested_capability: str | None = "Quote ranges for specialty transport when asked.",
) -> dict:
    return {
        "conversation_id": conversation_id,
        "insight_type": insight_type,
        "summary": summary,
        "signal_score": signal_score,
        "suggested_capability": suggested_capability,
        "reasoning": "Bot answered but never asked for contact info.",
        "classifier_model": "claude-sonnet-4-5",
    }


def test_upsert_insight_creates_row() -> None:
    cid = _make_conversation("thr_insight_create")
    r = client.post(
        "/embed/insights/upsert",
        json=_insight_payload(cid, insight_type="missed_lead", signal_score=0.82),
        headers=AUTH,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["conversation_id"] == cid
    assert data["agent_slug"] == "luxai1"
    assert data["insight_type"] == "missed_lead"
    assert data["signal_score"] == 0.82
    assert data["classifier_model"] == "claude-sonnet-4-5"
    assert data["suggested_capability"]


def test_upsert_insight_rejects_unknown_type() -> None:
    cid = _make_conversation("thr_insight_badtype")
    r = client.post(
        "/embed/insights/upsert",
        json=_insight_payload(cid, insight_type="not_a_real_type"),
        headers=AUTH,
    )
    assert r.status_code == 422, r.text


def test_upsert_insight_404_on_missing_conversation() -> None:
    r = client.post(
        "/embed/insights/upsert",
        json=_insight_payload(999_999_999),
        headers=AUTH,
    )
    assert r.status_code == 404


def test_upsert_insight_idempotent_on_conversation_id() -> None:
    cid = _make_conversation("thr_insight_idempotent")
    r1 = client.post(
        "/embed/insights/upsert",
        json=_insight_payload(cid, insight_type="capability_gap", signal_score=0.4),
        headers=AUTH,
    )
    assert r1.status_code == 200
    insight_id_1 = r1.json()["id"]

    r2 = client.post(
        "/embed/insights/upsert",
        json=_insight_payload(cid, insight_type="missed_lead", signal_score=0.9),
        headers=AUTH,
    )
    assert r2.status_code == 200
    assert r2.json()["id"] == insight_id_1, "must replace in-place, not insert"
    assert r2.json()["insight_type"] == "missed_lead"
    assert r2.json()["signal_score"] == 0.9

    # And only one row exists in the DB for this conversation.
    with Session(engine) as session:
        rows = session.exec(
            select(EmbedInsight).where(EmbedInsight.conversation_id == cid)
        ).all()
        assert len(rows) == 1


def test_list_insights_ranks_by_signal_desc() -> None:
    cid_low = _make_conversation("thr_list_low")
    cid_mid = _make_conversation("thr_list_mid")
    cid_high = _make_conversation("thr_list_high")
    for cid, score in [(cid_low, 0.10), (cid_mid, 0.55), (cid_high, 0.95)]:
        client.post(
            "/embed/insights/upsert",
            json=_insight_payload(cid, signal_score=score),
            headers=AUTH,
        )

    r = client.get("/embed/luxai1/insights", headers=AUTH)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data["items"]
    # The three we inserted should appear in descending order in the list.
    high_idx = next(
        i for i, it in enumerate(items) if it["insight"]["conversation_id"] == cid_high
    )
    mid_idx = next(
        i for i, it in enumerate(items) if it["insight"]["conversation_id"] == cid_mid
    )
    low_idx = next(
        i for i, it in enumerate(items) if it["insight"]["conversation_id"] == cid_low
    )
    assert high_idx < mid_idx < low_idx
    # by_type counts always include the four canonical buckets.
    assert set(data["by_type"].keys()) == {
        "missed_lead",
        "capability_gap",
        "off_brand",
        "great_save",
    }


def test_list_insights_filters_by_type() -> None:
    cid_a = _make_conversation("thr_filter_a")
    cid_b = _make_conversation("thr_filter_b")
    client.post(
        "/embed/insights/upsert",
        json=_insight_payload(cid_a, insight_type="great_save", signal_score=0.6),
        headers=AUTH,
    )
    client.post(
        "/embed/insights/upsert",
        json=_insight_payload(cid_b, insight_type="off_brand", signal_score=0.7),
        headers=AUTH,
    )

    r = client.get(
        "/embed/luxai1/insights?insight_type=great_save",
        headers=AUTH,
    )
    assert r.status_code == 200
    items = r.json()["items"]
    assert all(it["insight"]["insight_type"] == "great_save" for it in items)
    assert any(
        it["insight"]["conversation_id"] == cid_a for it in items
    )
    assert not any(
        it["insight"]["conversation_id"] == cid_b for it in items
    )


def test_pending_excludes_already_classified() -> None:
    cid_pending = _make_conversation("thr_pending_unclassified")
    cid_done = _make_conversation("thr_pending_done")
    # Classify cid_done — it should drop out of the pending queue.
    client.post(
        "/embed/insights/upsert",
        json=_insight_payload(cid_done),
        headers=AUTH,
    )

    r = client.get("/embed/luxai1/insights/pending", headers=AUTH)
    assert r.status_code == 200
    ids = [it["conversation"]["id"] for it in r.json()["items"]]
    assert cid_pending in ids
    assert cid_done not in ids


def test_pending_excludes_active_under_cooldown() -> None:
    # Active row that updated 30s ago — way under the default 5-minute
    # cooldown. Must NOT appear in the pending queue.
    cid_hot = _make_conversation(
        "thr_pending_active_hot",
        status="active",
        last_turn_offset=timedelta(seconds=30),
    )
    # Active row that paused 10 minutes ago — past the cooldown, should
    # be eligible.
    cid_cold = _make_conversation(
        "thr_pending_active_cold",
        status="active",
        last_turn_offset=timedelta(minutes=10),
    )

    r = client.get("/embed/luxai1/insights/pending", headers=AUTH)
    assert r.status_code == 200
    ids = [it["conversation"]["id"] for it in r.json()["items"]]
    assert cid_hot not in ids
    assert cid_cold in ids


def test_pending_total_reflects_full_backlog_not_page() -> None:
    """Regression: total must count every eligible row, not just the page.

    The cron consumer reports `total` as the backlog size in its run
    summary; capping it at `limit` would silently mask a runaway queue.
    Insert > limit eligible rows and verify total > limit while items
    is bounded by limit.
    """
    limit = 3
    eligible_ids: list[int] = []
    for i in range(limit + 2):
        eligible_ids.append(
            _make_conversation(
                f"thr_pending_total_{i}",
                status="converted",
                last_turn_offset=timedelta(minutes=10 + i),
            )
        )

    r = client.get(
        f"/embed/luxai1/insights/pending?limit={limit}",
        headers=AUTH,
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert len(payload["items"]) == limit
    assert payload["total"] >= len(eligible_ids), (
        f"total={payload['total']} must reflect full backlog "
        f"(>= {len(eligible_ids)} just-inserted eligible rows), not the page size"
    )
    assert payload["total"] > limit


def test_pending_excludes_zero_turn_rows() -> None:
    cid_empty = _make_conversation(
        "thr_pending_empty",
        status="abandoned",
        turn_count=0,
        transcript="[]",
    )
    r = client.get("/embed/luxai1/insights/pending", headers=AUTH)
    assert r.status_code == 200
    ids = [it["conversation"]["id"] for it in r.json()["items"]]
    assert cid_empty not in ids


def test_routes_require_internal_auth() -> None:
    cid = _make_conversation("thr_insight_auth")
    with _AuthGate():
        r1 = client.post(
            "/embed/insights/upsert",
            json=_insight_payload(cid),
        )
        assert r1.status_code == 401
        r2 = client.get("/embed/luxai1/insights")
        assert r2.status_code == 401
        r3 = client.get("/embed/luxai1/insights/pending")
        assert r3.status_code == 401
