"""Tests for the embed mentor-note routes (PR #34).

Coverage:
  * POST /embed/{slug}/mentor-notes creates a pending row
  * POST /mentor-notes/{id}/round appends, replaces same-reviewer in-place
  * Status transitions: pending → reviewing on first round
  * POST /mentor-notes/{id}/finalize requires all reviewers + all approve
  * Rejection requires at least one reject in chain
  * Terminal-status guards prevent double-apply / re-reject / round-after-final
  * POST /mentor-notes/{id}/retract only valid from applied
  * GET /{slug}/mentor-notes filters + counts
  * GET /{slug}/mentor-notes/active returns only applied notes (no auth)
  * source_insight_id 404s when the insight doesn't exist
"""
from __future__ import annotations

import os
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from sof_ai_api.db import engine, init_db
from sof_ai_api.main import app
from sof_ai_api.models import (
    EmbedConversation,
    EmbedInsight,
    EmbedMentorNote,
    _utcnow,
)
from sof_ai_api.settings import settings

os.environ.setdefault("INTERNAL_API_KEY", "test-internal-key")
init_db()
client = TestClient(app)
AUTH = {"X-Internal-Auth": "test-internal-key"}


class _AuthGate:
    def __enter__(self) -> None:
        self._prior = settings.internal_api_key
        settings.internal_api_key = "test-internal-key"

    def __exit__(self, *_exc: object) -> None:
        settings.internal_api_key = self._prior


def _seed_insight(slug: str = "luxai1") -> int:
    with Session(engine) as session:
        c = EmbedConversation(
            agent_slug=slug,
            client_thread_id=f"thr-{_utcnow().timestamp()}",
            owner_email="luxservicesbayarea@gmail.com",
            turn_count=3,
            lead_submitted=False,
            status="abandoned",
            last_turn_at=_utcnow() - timedelta(hours=1),
        )
        session.add(c)
        session.commit()
        session.refresh(c)
        assert c.id is not None
        i = EmbedInsight(
            conversation_id=c.id,
            agent_slug=slug,
            insight_type="capability_gap",
            summary="Visitor asked about Sunday availability; agent didn't have an answer.",
            signal_score=0.72,
            suggested_capability="Recognize Sunday availability and offer scheduled callback.",
            reasoning="Test seed.",
        )
        session.add(i)
        session.commit()
        session.refresh(i)
        assert i.id is not None
        return i.id


def _propose(text: str, *, source_insight_id: int | None = None) -> dict:
    return {
        "proposed_by_email": "luxservicesbayarea@gmail.com",
        "proposed_text": text,
        "source_insight_id": source_insight_id,
    }


def test_propose_creates_pending_row() -> None:
    with _AuthGate():
        res = client.post(
            "/embed/luxai1/mentor-notes",
            json=_propose("Recognize 'piano' as specialty_transport"),
            headers=AUTH,
        )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "pending"
    assert body["agent_slug"] == "luxai1"
    assert body["proposed_by_email"] == "luxservicesbayarea@gmail.com"
    assert body["applied_text"] == ""
    assert body["applied_at"] is None
    assert body["reviewer_chain"] == []


def test_propose_404s_on_unknown_insight() -> None:
    with _AuthGate():
        res = client.post(
            "/embed/luxai1/mentor-notes",
            json=_propose("test", source_insight_id=999_999),
            headers=AUTH,
        )
    assert res.status_code == 404
    assert "source_insight_not_found" in res.text


def test_propose_links_to_real_insight() -> None:
    insight_id = _seed_insight()
    with _AuthGate():
        res = client.post(
            "/embed/luxai1/mentor-notes",
            json=_propose("Add Sunday slots", source_insight_id=insight_id),
            headers=AUTH,
        )
    assert res.status_code == 201, res.text
    assert res.json()["source_insight_id"] == insight_id


def _create_note(text: str = "Recognize 'piano' as specialty_transport") -> int:
    with _AuthGate():
        res = client.post(
            "/embed/luxai1/mentor-notes",
            json=_propose(text),
            headers=AUTH,
        )
    return res.json()["id"]


def _round(reviewer_id: str, verdict: str = "approve") -> dict:
    return {
        "reviewer_id": reviewer_id,
        "verdict": verdict,
        "summary": f"{reviewer_id} {verdict} summary",
        "body": f"{reviewer_id} {verdict} body",
    }


def test_first_round_flips_pending_to_reviewing() -> None:
    nid = _create_note()
    with _AuthGate():
        res = client.post(
            f"/embed/mentor-notes/{nid}/round",
            json=_round("claude"),
            headers=AUTH,
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "reviewing"
    assert len(body["reviewer_chain"]) == 1
    assert body["reviewer_chain"][0]["reviewer_id"] == "claude"


def test_round_replaces_same_reviewer_in_place() -> None:
    nid = _create_note()
    with _AuthGate():
        client.post(
            f"/embed/mentor-notes/{nid}/round",
            json=_round("claude"),
            headers=AUTH,
        )
        res = client.post(
            f"/embed/mentor-notes/{nid}/round",
            json={
                "reviewer_id": "claude",
                "verdict": "reject",
                "summary": "changed mind",
                "body": "fresh body",
            },
            headers=AUTH,
        )
    body = res.json()
    chain = body["reviewer_chain"]
    assert len(chain) == 1
    assert chain[0]["verdict"] == "reject"
    assert chain[0]["summary"] == "changed mind"


def test_round_validates_reviewer_and_verdict() -> None:
    nid = _create_note()
    with _AuthGate():
        bad_reviewer = client.post(
            f"/embed/mentor-notes/{nid}/round",
            json={"reviewer_id": "perplexity", "verdict": "approve"},
            headers=AUTH,
        )
        bad_verdict = client.post(
            f"/embed/mentor-notes/{nid}/round",
            json={"reviewer_id": "claude", "verdict": "maybe"},
            headers=AUTH,
        )
    assert bad_reviewer.status_code == 422
    assert bad_verdict.status_code == 422


def _full_approve(nid: int) -> None:
    with _AuthGate():
        for r in ("claude", "devin", "gemini"):
            client.post(
                f"/embed/mentor-notes/{nid}/round",
                json=_round(r),
                headers=AUTH,
            )


def test_finalize_apply_requires_all_reviewers() -> None:
    nid = _create_note()
    with _AuthGate():
        client.post(
            f"/embed/mentor-notes/{nid}/round",
            json=_round("claude"),
            headers=AUTH,
        )
        res = client.post(
            f"/embed/mentor-notes/{nid}/finalize",
            json={"status": "applied"},
            headers=AUTH,
        )
    assert res.status_code == 422
    assert "missing_reviewers" in res.text


def test_finalize_apply_blocks_on_rejection_in_chain() -> None:
    nid = _create_note()
    with _AuthGate():
        for r in ("claude", "devin"):
            client.post(
                f"/embed/mentor-notes/{nid}/round",
                json=_round(r),
                headers=AUTH,
            )
        client.post(
            f"/embed/mentor-notes/{nid}/round",
            json=_round("gemini", "reject"),
            headers=AUTH,
        )
        res = client.post(
            f"/embed/mentor-notes/{nid}/finalize",
            json={"status": "applied"},
            headers=AUTH,
        )
    assert res.status_code == 422
    assert "has_rejection" in res.text


def test_finalize_apply_succeeds_with_unanimous_approve() -> None:
    nid = _create_note()
    _full_approve(nid)
    with _AuthGate():
        res = client.post(
            f"/embed/mentor-notes/{nid}/finalize",
            json={
                "status": "applied",
                "applied_text": (
                    "When a visitor mentions a piano, classify the"
                    " move as specialty_transport."
                ),
            },
            headers=AUTH,
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "applied"
    assert body["applied_at"] is not None
    assert body["applied_text"].startswith("When a visitor mentions a piano")


def test_finalize_apply_uses_proposed_text_when_no_override() -> None:
    nid = _create_note("Recognize piano as specialty_transport")
    _full_approve(nid)
    with _AuthGate():
        res = client.post(
            f"/embed/mentor-notes/{nid}/finalize",
            json={"status": "applied"},
            headers=AUTH,
        )
    assert res.status_code == 200
    assert res.json()["applied_text"] == "Recognize piano as specialty_transport"


def test_finalize_reject_requires_a_reject_in_chain() -> None:
    nid = _create_note()
    _full_approve(nid)
    with _AuthGate():
        res = client.post(
            f"/embed/mentor-notes/{nid}/finalize",
            json={"status": "rejected", "rejection_reason": "off-brand"},
            headers=AUTH,
        )
    assert res.status_code == 422
    assert "no_rejection_in_chain" in res.text


def test_finalize_reject_succeeds_with_a_rejection() -> None:
    nid = _create_note()
    with _AuthGate():
        client.post(
            f"/embed/mentor-notes/{nid}/round",
            json=_round("claude", "reject"),
            headers=AUTH,
        )
        res = client.post(
            f"/embed/mentor-notes/{nid}/finalize",
            json={"status": "rejected", "rejection_reason": "off-brand"},
            headers=AUTH,
        )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "rejected"
    assert body["rejection_reason"] == "off-brand"
    assert body["applied_text"] == ""


def test_round_after_terminal_blocks() -> None:
    nid = _create_note()
    _full_approve(nid)
    with _AuthGate():
        client.post(
            f"/embed/mentor-notes/{nid}/finalize",
            json={"status": "applied"},
            headers=AUTH,
        )
        res = client.post(
            f"/embed/mentor-notes/{nid}/round",
            json=_round("claude"),
            headers=AUTH,
        )
    assert res.status_code == 409
    assert "terminal_status" in res.text


def test_finalize_idempotent_in_same_direction() -> None:
    nid = _create_note()
    _full_approve(nid)
    with _AuthGate():
        first = client.post(
            f"/embed/mentor-notes/{nid}/finalize",
            json={"status": "applied"},
            headers=AUTH,
        )
        second = client.post(
            f"/embed/mentor-notes/{nid}/finalize",
            json={"status": "applied"},
            headers=AUTH,
        )
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["applied_at"] == second.json()["applied_at"]


def test_finalize_cross_direction_blocks() -> None:
    nid = _create_note()
    _full_approve(nid)
    with _AuthGate():
        client.post(
            f"/embed/mentor-notes/{nid}/finalize",
            json={"status": "applied"},
            headers=AUTH,
        )
        res = client.post(
            f"/embed/mentor-notes/{nid}/finalize",
            json={"status": "rejected"},
            headers=AUTH,
        )
    assert res.status_code == 409


def test_retract_only_from_applied() -> None:
    nid = _create_note()
    with _AuthGate():
        # Pending → can't retract.
        bad = client.post(f"/embed/mentor-notes/{nid}/retract", headers=AUTH)
    assert bad.status_code == 409

    _full_approve(nid)
    with _AuthGate():
        client.post(
            f"/embed/mentor-notes/{nid}/finalize",
            json={"status": "applied"},
            headers=AUTH,
        )
        ok = client.post(f"/embed/mentor-notes/{nid}/retract", headers=AUTH)
    assert ok.status_code == 200
    assert ok.json()["status"] == "retracted"


def test_active_endpoint_filters_to_applied_only_and_is_unauthed() -> None:
    """``/active`` is the route the chat endpoint calls per request to fold
    notes into the system prompt. It must NOT require the internal-auth
    header (cross-origin, customer-facing)."""
    # Create one applied + one rejected + one pending, then assert /active
    # returns only the applied row.
    applied_id = _create_note("ACTIVE NOTE — applied")
    _full_approve(applied_id)
    with _AuthGate():
        client.post(
            f"/embed/mentor-notes/{applied_id}/finalize",
            json={"status": "applied"},
            headers=AUTH,
        )

    rejected_id = _create_note("REJECTED — should not show")
    with _AuthGate():
        client.post(
            f"/embed/mentor-notes/{rejected_id}/round",
            json=_round("claude", "reject"),
            headers=AUTH,
        )
        client.post(
            f"/embed/mentor-notes/{rejected_id}/finalize",
            json={"status": "rejected"},
            headers=AUTH,
        )

    _create_note("PENDING — should not show")  # noqa: F841

    # Note: no AUTH header.
    res = client.get("/embed/luxai1/mentor-notes/active")
    assert res.status_code == 200
    items = res.json()["items"]
    texts = [item["applied_text"] for item in items]
    assert "ACTIVE NOTE — applied" in texts
    assert all("REJECTED" not in t and "PENDING" not in t for t in texts)


def test_list_filters_by_status_and_tallies_full_set() -> None:
    # Reset state by counting the existing rows so this test isn't
    # coupled to absolute totals from prior tests in the same DB.
    with Session(engine) as session:
        existing_pending = len(
            session.exec(
                select(EmbedMentorNote)
                .where(EmbedMentorNote.agent_slug == "luxai1")
                .where(EmbedMentorNote.status == "pending")
            ).all()
        )

    _create_note("filter test note 1")
    _create_note("filter test note 2")

    with _AuthGate():
        res = client.get(
            "/embed/luxai1/mentor-notes?status=pending",
            headers=AUTH,
        )
    assert res.status_code == 200
    body = res.json()
    by = body["by_status"]
    # by_status is over the FULL set (not the page filter), so it must
    # include the same pending count plus any rows in other statuses.
    assert by["pending"] >= existing_pending + 2
    # Page filter actually limits items to status="pending".
    for item in body["items"]:
        assert item["status"] == "pending"


def test_routes_require_internal_auth() -> None:
    """All write routes + the trainer-console list must enforce auth.

    /active is the documented exception (customer-facing chat path).
    """
    with _AuthGate():
        no_auth = client.post(
            "/embed/luxai1/mentor-notes",
            json=_propose("unauthenticated"),
        )
    assert no_auth.status_code in (401, 403)

    nid = _create_note("auth gate test")
    with _AuthGate():
        no_auth_round = client.post(
            f"/embed/mentor-notes/{nid}/round",
            json=_round("claude"),
        )
        no_auth_finalize = client.post(
            f"/embed/mentor-notes/{nid}/finalize",
            json={"status": "applied"},
        )
        no_auth_retract = client.post(
            f"/embed/mentor-notes/{nid}/retract",
        )
        no_auth_list = client.get("/embed/luxai1/mentor-notes")
    assert no_auth_round.status_code in (401, 403)
    assert no_auth_finalize.status_code in (401, 403)
    assert no_auth_retract.status_code in (401, 403)
    assert no_auth_list.status_code in (401, 403)
