"""Tests for actionable + claim endpoints on challenges."""

from fastapi.testclient import TestClient

from sof_ai_api.db import init_db
from sof_ai_api.main import app

init_db()
client = TestClient(app)


def _create(body_text: str, tag: str = "idea", user_id: str = "u-claim-1") -> int:
    r = client.post(
        "/challenges",
        json={
            "user_id": user_id,
            "handle": "tester",
            "body": body_text,
            "tag": tag,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _triage(challenge_id: int) -> None:
    r = client.patch(f"/challenges/{challenge_id}", json={"status": "triaged"})
    assert r.status_code == 200


def test_actionable_returns_triaged_broken_missing_idea_confusing() -> None:
    cid_broken = _create("thing is broken", "broken", "u-claim-actionable-1")
    cid_missing = _create("thing is missing", "missing", "u-claim-actionable-2")
    cid_idea = _create("I have an idea", "idea", "u-claim-actionable-3")
    cid_confusing = _create("this is confusing", "confusing", "u-claim-actionable-4")
    cid_question = _create("is there a reason?", "question", "u-claim-actionable-5")

    for cid in (cid_broken, cid_missing, cid_idea, cid_confusing, cid_question):
        _triage(cid)

    r = client.get("/challenges/actionable")
    assert r.status_code == 200
    ids = {c["id"] for c in r.json()}
    assert cid_broken in ids
    assert cid_missing in ids
    assert cid_idea in ids
    assert cid_confusing in ids
    # Questions are not actionable by Devin.
    assert cid_question not in ids


def test_claim_sets_status_building_and_records_claimer() -> None:
    cid = _create("claim me", "idea", "u-claim-flow-1")
    _triage(cid)

    r = client.post(
        f"/challenges/{cid}/claim",
        json={
            "claimer_type": "agent",
            "claimer_id": "devin",
            "pr_url": "https://github.com/DearMrFree/sof-ai-repo/pull/123",
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "building"

    claims = client.get(f"/challenges/{cid}/claims")
    assert claims.status_code == 200
    rows = claims.json()
    assert len(rows) == 1
    assert rows[0]["claimer_id"] == "devin"
    assert rows[0]["pr_url"] == "https://github.com/DearMrFree/sof-ai-repo/pull/123"


def test_cannot_claim_shipped() -> None:
    cid = _create("already shipped", "idea", "u-claim-shipped-1")
    client.patch(f"/challenges/{cid}", json={"status": "shipped"})
    r = client.post(
        f"/challenges/{cid}/claim",
        json={"claimer_type": "agent", "claimer_id": "devin"},
    )
    assert r.status_code == 409


def test_bad_claimer_type_rejected() -> None:
    cid = _create("bad type", "idea", "u-claim-badtype-1")
    _triage(cid)
    r = client.post(
        f"/challenges/{cid}/claim",
        json={"claimer_type": "robot", "claimer_id": "devin"},
    )
    assert r.status_code == 400
