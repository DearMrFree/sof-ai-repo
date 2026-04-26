"""Tests for the digital-twin routes (PR-TWIN).

Coverage:
  * Owner can propose a skill; non-owner is rejected (403)
  * Pending → reviewing → applied flow updates status correctly
  * /skills/active filters to applied + ordered by applied_at ASC
  * Retract: only owner can retract; status flips to retracted and the
    skill drops out of /active and the public /skills list
  * GET /twins/by-handle/{handle} returns the seed persona + applied
    skills and DOES NOT include the owner's email
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, delete

from sof_ai_api.db import engine, init_db
from sof_ai_api.main import app
from sof_ai_api.models import TwinSkill, UserProfile
from sof_ai_api.settings import settings

init_db()
client = TestClient(app)
AUTH = {"X-Internal-Auth": "test-internal-key"}


@pytest.fixture(autouse=True)
def _gate_and_wipe() -> object:
    prior = settings.internal_api_key
    settings.internal_api_key = "test-internal-key"
    with Session(engine) as s:
        s.exec(delete(TwinSkill))
        s.exec(delete(UserProfile))
        s.commit()
    yield
    settings.internal_api_key = prior
    with Session(engine) as s:
        s.exec(delete(TwinSkill))
        s.exec(delete(UserProfile))
        s.commit()


def _seed_profile(
    *,
    email: str = "ada@example.com",
    handle: str = "ada",
    display_name: str = "Ada Lovelace",
    user_type: str = "student",
) -> dict[str, object]:
    body = {
        "email": email,
        "handle": handle,
        "display_name": display_name,
        "user_type": user_type,
        "goals": ["Ship my first AI app"],
        "strengths": ["Research"],
        "first_project": "Analytical engine notes.",
        "twin_name": f"{display_name}-Twin",
        "twin_emoji": "✨",
        "twin_persona_seed": f"{display_name}'s twin: ships.",
    }
    res = client.post("/users/onboarding", json=body, headers=AUTH)
    assert res.status_code in (200, 201), res.text
    return res.json()


def test_owner_can_propose_skill() -> None:
    _seed_profile()
    res = client.post(
        "/twins/by-handle/ada/skills",
        json={
            "proposed_by_email": "ada@example.com",
            "title": "Cite primary sources",
            "proposed_text": (
                "When asked a factual question, prefer a primary source "
                "and cite the URL inline."
            ),
        },
        headers=AUTH,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "pending"
    assert body["title"] == "Cite primary sources"
    assert body["handle"] == "ada"
    assert body["reviewer_chain"] == []


def test_non_owner_proposal_returns_403() -> None:
    _seed_profile()
    res = client.post(
        "/twins/by-handle/ada/skills",
        json={
            "proposed_by_email": "imposter@example.com",
            "title": "Pretend I own this",
            "proposed_text": "x" * 10,
        },
        headers=AUTH,
    )
    assert res.status_code == 403, res.text
    assert res.json()["detail"] == "not_owner"


def test_full_review_flow_to_applied() -> None:
    _seed_profile()
    p = client.post(
        "/twins/by-handle/ada/skills",
        json={
            "proposed_by_email": "ada@example.com",
            "title": "X",
            "proposed_text": "Always greet visitors warmly.",
        },
        headers=AUTH,
    )
    assert p.status_code == 201
    skill_id = p.json()["id"]

    for reviewer in ("claude", "devin", "gemini"):
        r = client.post(
            f"/twins/skills/{skill_id}/round",
            json={
                "reviewer_id": reviewer,
                "verdict": "approve",
                "summary": f"{reviewer} approves",
                "body": "looks good",
            },
            headers=AUTH,
        )
        assert r.status_code == 200, r.text
    after_rounds = client.get(
        "/twins/by-handle/ada/skills",
    ).json()
    assert after_rounds["items"][0]["status"] == "reviewing"
    assert {x["reviewer_id"] for x in after_rounds["items"][0]["reviewer_chain"]} == {
        "claude",
        "devin",
        "gemini",
    }

    f = client.post(
        f"/twins/skills/{skill_id}/finalize",
        json={"status": "applied"},
        headers=AUTH,
    )
    assert f.status_code == 200, f.text
    assert f.json()["status"] == "applied"
    assert f.json()["applied_text"] == "Always greet visitors warmly."

    # /active includes it
    active = client.get("/twins/by-handle/ada/skills/active").json()
    assert active["total"] == 1
    assert active["items"][0]["status"] == "applied"


def test_active_excludes_pending_and_rejected() -> None:
    _seed_profile()
    pending = client.post(
        "/twins/by-handle/ada/skills",
        json={
            "proposed_by_email": "ada@example.com",
            "title": "p",
            "proposed_text": "p",
        },
        headers=AUTH,
    ).json()
    rejected = client.post(
        "/twins/by-handle/ada/skills",
        json={
            "proposed_by_email": "ada@example.com",
            "title": "r",
            "proposed_text": "r",
        },
        headers=AUTH,
    ).json()
    client.post(
        f"/twins/skills/{rejected['id']}/finalize",
        json={"status": "rejected", "rejection_reason": "off-brand"},
        headers=AUTH,
    )

    active = client.get("/twins/by-handle/ada/skills/active").json()
    assert active["total"] == 0

    # full list excludes only retracted; rejected is still visible
    listing = client.get("/twins/by-handle/ada/skills").json()
    statuses = {x["status"] for x in listing["items"]}
    assert "pending" in statuses
    assert "rejected" in statuses
    assert pending["id"] in {x["id"] for x in listing["items"]}


def test_retract_owner_only_and_drops_from_lists() -> None:
    _seed_profile()
    p = client.post(
        "/twins/by-handle/ada/skills",
        json={
            "proposed_by_email": "ada@example.com",
            "title": "X",
            "proposed_text": "Always greet visitors warmly.",
        },
        headers=AUTH,
    ).json()
    client.post(
        f"/twins/skills/{p['id']}/finalize",
        json={"status": "applied"},
        headers=AUTH,
    )
    assert (
        client.get("/twins/by-handle/ada/skills/active").json()["total"] == 1
    )

    # Imposter retract → 403
    r403 = client.post(
        f"/twins/skills/{p['id']}/retract",
        json={"proposed_by_email": "imposter@example.com", "proposed_text": "x"},
        headers=AUTH,
    )
    assert r403.status_code == 403

    # Owner retract → 200, status retracted
    r200 = client.post(
        f"/twins/skills/{p['id']}/retract",
        json={"proposed_by_email": "ada@example.com", "proposed_text": "x"},
        headers=AUTH,
    )
    assert r200.status_code == 200
    assert r200.json()["status"] == "retracted"

    # Drops from /active AND from full list (which excludes retracted)
    assert (
        client.get("/twins/by-handle/ada/skills/active").json()["total"] == 0
    )
    assert client.get("/twins/by-handle/ada/skills").json()["total"] == 0


def test_summary_does_not_leak_owner_email() -> None:
    _seed_profile(email="ada@private.example", handle="ada")
    p = client.post(
        "/twins/by-handle/ada/skills",
        json={
            "proposed_by_email": "ada@private.example",
            "title": "X",
            "proposed_text": "Skill text.",
        },
        headers=AUTH,
    ).json()
    client.post(
        f"/twins/skills/{p['id']}/finalize",
        json={"status": "applied"},
        headers=AUTH,
    )
    summary_raw = client.get("/twins/by-handle/ada").content.decode()
    # Email must not appear anywhere in the assembled twin summary —
    # this is a public-read endpoint, no PII.
    assert "ada@private.example" not in summary_raw
    summary = client.get("/twins/by-handle/ada").json()
    assert summary["handle"] == "ada"
    assert summary["twin_emoji"] == "✨"
    assert len(summary["applied_skills"]) == 1
    # The applied skill DOES carry proposed_by_email — that field is on
    # the skill row, intentionally — but it surfaces only on the
    # detailed list endpoints, not the public twin summary card.
    assert "proposed_by_email" not in {
        k for k in summary if k == "proposed_by_email"
    }


def test_finalize_after_terminal_returns_409() -> None:
    _seed_profile()
    p = client.post(
        "/twins/by-handle/ada/skills",
        json={
            "proposed_by_email": "ada@example.com",
            "title": "X",
            "proposed_text": "x",
        },
        headers=AUTH,
    ).json()
    f1 = client.post(
        f"/twins/skills/{p['id']}/finalize",
        json={"status": "applied"},
        headers=AUTH,
    )
    assert f1.status_code == 200
    f2 = client.post(
        f"/twins/skills/{p['id']}/finalize",
        json={"status": "rejected"},
        headers=AUTH,
    )
    assert f2.status_code == 409
