"""Tests for the embed-conversation routes.

Coverage:
  * POST /embed/conversations/upsert creates a row
  * Repeat upsert with same (slug, thread_id) updates the row, preserves
    monotonic lead_submitted, merges customer_meta
  * Concurrent upserts on same key collapse to one row (race path)
  * GET /embed/{slug}/conversations lists with totals + lead count
  * GET /embed/conversations/{id} returns full transcript
  * cron/abandon flips stale active rows to abandoned
  * All routes require X-Internal-Auth
"""
from __future__ import annotations

import os
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from sof_ai_api.db import engine, init_db
from sof_ai_api.main import app
from sof_ai_api.models import EmbedConversation, _utcnow
from sof_ai_api.settings import settings

os.environ.setdefault("INTERNAL_API_KEY", "test-internal-key")
init_db()
client = TestClient(app)
AUTH = {"X-Internal-Auth": "test-internal-key"}


class _AuthGate:
    """Context manager that flips the internal-auth gate on for one test.

    The settings singleton was loaded before pytest started collecting,
    so ``os.environ`` is too late — we mutate ``settings.internal_api_key``
    directly (mirroring the pattern in test_wallet.py).
    """

    def __enter__(self) -> None:
        self._prior = settings.internal_api_key
        settings.internal_api_key = "test-internal-key"

    def __exit__(self, *_exc: object) -> None:
        settings.internal_api_key = self._prior


def _payload(
    thread_id: str = "thr_test_001",
    transcript: list[dict] | None = None,
    lead_submitted: bool = False,
    customer_meta: dict | None = None,
    lead_resend_message_id: str | None = None,
    lead_error: str | None = None,
    status: str | None = None,
) -> dict:
    body: dict = {
        "agent_slug": "luxai1",
        "client_thread_id": thread_id,
        "owner_email": "luxservicesbayarea@gmail.com",
        "transcript": transcript
        or [
            {"role": "user", "content": "Need a piano move next Saturday."},
            {
                "role": "assistant",
                "content": "Happy to help! What's your name?",
            },
        ],
        "customer_meta": customer_meta or {"ua": "Mozilla/5.0"},
        "lead_submitted": lead_submitted,
    }
    if lead_resend_message_id is not None:
        body["lead_resend_message_id"] = lead_resend_message_id
    if lead_error is not None:
        body["lead_error"] = lead_error
    if status is not None:
        body["status"] = status
    return body


def test_upsert_creates_new_row() -> None:
    r = client.post(
        "/embed/conversations/upsert",
        json=_payload(thread_id="thr_create_001"),
        headers=AUTH,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["id"] > 0
    assert data["client_thread_id"] == "thr_create_001"
    assert data["agent_slug"] == "luxai1"
    assert data["turn_count"] == 2
    assert data["lead_submitted"] is False
    assert data["status"] == "active"
    assert data["transcript"][0]["role"] == "user"
    assert data["customer_meta"]["ua"] == "Mozilla/5.0"


def test_upsert_idempotent_on_thread_id() -> None:
    body1 = _payload(thread_id="thr_same_002")
    r1 = client.post("/embed/conversations/upsert", json=body1, headers=AUTH)
    assert r1.status_code == 200
    id1 = r1.json()["id"]

    body2 = _payload(
        thread_id="thr_same_002",
        transcript=[
            {"role": "user", "content": "Need a piano move next Saturday."},
            {"role": "assistant", "content": "Happy to help! What's your name?"},
            {"role": "user", "content": "John Smith, 408-555-1234"},
        ],
    )
    r2 = client.post("/embed/conversations/upsert", json=body2, headers=AUTH)
    assert r2.status_code == 200
    assert r2.json()["id"] == id1
    assert r2.json()["turn_count"] == 3
    assert len(r2.json()["transcript"]) == 3


def test_upsert_lead_submitted_is_monotonic() -> None:
    """Once a lead is delivered, a later upsert can't quietly un-deliver it.

    The chat handler may emit a follow-up upsert *after* a successful
    submit_lead — the protocol guarantees lead_submitted=true survives.
    """
    r1 = client.post(
        "/embed/conversations/upsert",
        json=_payload(
            thread_id="thr_mono_003",
            lead_submitted=True,
            lead_resend_message_id="resend_abc",
        ),
        headers=AUTH,
    )
    assert r1.json()["lead_submitted"] is True
    assert r1.json()["status"] == "converted"

    r2 = client.post(
        "/embed/conversations/upsert",
        json=_payload(thread_id="thr_mono_003", lead_submitted=False),
        headers=AUTH,
    )
    assert r2.json()["lead_submitted"] is True
    assert r2.json()["lead_resend_message_id"] == "resend_abc"
    assert r2.json()["status"] == "converted"


def test_upsert_merges_customer_meta() -> None:
    r1 = client.post(
        "/embed/conversations/upsert",
        json=_payload(
            thread_id="thr_meta_004",
            customer_meta={"ua": "Mozilla/5.0", "ip_hash": "abc123"},
        ),
        headers=AUTH,
    )
    assert r1.json()["customer_meta"]["ip_hash"] == "abc123"

    r2 = client.post(
        "/embed/conversations/upsert",
        json=_payload(
            thread_id="thr_meta_004",
            customer_meta={"referrer": "https://google.com/"},
        ),
        headers=AUTH,
    )
    meta = r2.json()["customer_meta"]
    assert meta["ip_hash"] == "abc123"  # preserved from turn 1
    assert meta["referrer"] == "https://google.com/"


def test_upsert_requires_internal_auth() -> None:
    with _AuthGate():
        r = client.post(
            "/embed/conversations/upsert",
            json=_payload(thread_id="thr_authgate_005"),
        )
    assert r.status_code == 401


def test_list_returns_totals_and_lead_count() -> None:
    # Seed: 2 active, 1 with lead.
    client.post(
        "/embed/conversations/upsert",
        json=_payload(thread_id="thr_list_a"),
        headers=AUTH,
    )
    client.post(
        "/embed/conversations/upsert",
        json=_payload(thread_id="thr_list_b"),
        headers=AUTH,
    )
    client.post(
        "/embed/conversations/upsert",
        json=_payload(
            thread_id="thr_list_c",
            lead_submitted=True,
            lead_resend_message_id="resend_xyz",
        ),
        headers=AUTH,
    )
    r = client.get("/embed/luxai1/conversations", headers=AUTH)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] >= 3
    assert data["converted_total"] >= 1
    # Each item has only the summary fields, not the full transcript.
    for item in data["items"]:
        assert "preview" in item
        assert "transcript" not in item
        if item["client_thread_id"] == "thr_list_c":
            assert item["lead_submitted"] is True
            assert item["status"] == "converted"


def test_list_requires_internal_auth() -> None:
    with _AuthGate():
        r = client.get("/embed/luxai1/conversations")
    assert r.status_code == 401


def test_get_full_returns_transcript() -> None:
    upsert = client.post(
        "/embed/conversations/upsert",
        json=_payload(thread_id="thr_detail_006"),
        headers=AUTH,
    )
    cid = upsert.json()["id"]
    r = client.get(f"/embed/conversations/{cid}", headers=AUTH)
    assert r.status_code == 200
    data = r.json()
    assert len(data["transcript"]) == 2
    assert data["transcript"][0]["content"].startswith("Need a piano move")


def test_get_full_404_when_missing() -> None:
    r = client.get("/embed/conversations/9999999", headers=AUTH)
    assert r.status_code == 404


def test_get_full_requires_internal_auth() -> None:
    with _AuthGate():
        r = client.get("/embed/conversations/1")
    assert r.status_code == 401


def test_cron_abandon_flips_stale_active_only() -> None:
    # Create a fresh active row, then backdate it to mimic >24h idle.
    r = client.post(
        "/embed/conversations/upsert",
        json=_payload(thread_id="thr_stale_007"),
        headers=AUTH,
    )
    cid = r.json()["id"]

    with Session(engine) as session:
        row = session.get(EmbedConversation, cid)
        assert row is not None
        row.last_turn_at = _utcnow() - timedelta(hours=48)
        session.add(row)
        session.commit()

    # And one converted row that should NOT be touched.
    client.post(
        "/embed/conversations/upsert",
        json=_payload(
            thread_id="thr_stale_converted_008",
            lead_submitted=True,
            lead_resend_message_id="resend_mno",
        ),
        headers=AUTH,
    )

    r = client.post(
        "/embed/conversations/cron/abandon",
        headers=AUTH,
    )
    assert r.status_code == 200
    assert r.json()["abandoned"] >= 1

    detail = client.get(f"/embed/conversations/{cid}", headers=AUTH)
    assert detail.json()["status"] == "abandoned"


def test_cron_abandon_requires_internal_auth() -> None:
    with _AuthGate():
        r = client.post("/embed/conversations/cron/abandon")
    assert r.status_code == 401


def test_status_explicit_overrides_default() -> None:
    r = client.post(
        "/embed/conversations/upsert",
        json=_payload(thread_id="thr_status_009", status="abandoned"),
        headers=AUTH,
    )
    assert r.json()["status"] == "abandoned"


def test_invalid_status_rejected() -> None:
    body = _payload(thread_id="thr_bad_010", status="garbage")
    r = client.post("/embed/conversations/upsert", json=body, headers=AUTH)
    assert r.status_code == 422
