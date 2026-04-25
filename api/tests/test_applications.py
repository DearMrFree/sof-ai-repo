"""Tests for the agent-onboarding application routes.

Coverage:
  * Public submission persists with sane defaults + status "submitted"
  * GET /applications and /applications/{id} return what we wrote
  * /vet transitions through pass/needs_revision/reject correctly
  * /review enforces trio-only emails (non-trio → 403)
  * /review upserts on (application_id, reviewer_email) — no duplicate votes
  * /finalize requires status="trio_reviewing" (state-machine guard)
  * Status transitions through the full happy path
    submitted → trio_reviewing → conditionally_accepted
"""

from fastapi.testclient import TestClient

from sof_ai_api.db import init_db
from sof_ai_api.main import app

init_db()
client = TestClient(app)


def _submit(
    name: str = "Acme AI",
    email: str = "team@acme.example",
    public_listing: bool = False,
) -> dict:
    body = {
        "applicant_kind": "company_ai",
        "applicant_name": name,
        "applicant_email": email,
        "org_name": "Acme Inc",
        "agent_name": "Acme Helper",
        "agent_url": "https://acme.example/ai",
        "mission_statement": (
            "Acme Helper exists to help small-business owners flourish by "
            "removing tedious paperwork and giving their time back to family."
        ),
        "apa_statement": (
            "We treat every interaction with respect for users' dignity, "
            "do no harm, and act with integrity in our advertising."
        ),
        "public_listing": public_listing,
    }
    r = client.post("/applications", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_submit_persists_application_with_defaults() -> None:
    a = _submit()
    assert a["id"] > 0
    assert a["applicant_kind"] == "company_ai"
    assert a["applicant_email"] == "team@acme.example"
    assert a["status"] == "submitted"
    assert a["vet_status"] == "pending"
    assert a["public_listing"] is False


def test_get_application_returns_reviews_array() -> None:
    a = _submit(email="detail@acme.example")
    r = client.get(f"/applications/{a['id']}")
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["id"] == a["id"]
    assert detail["reviews"] == []


def test_list_applications_filters_to_public_only() -> None:
    public = _submit(name="Public Acme", email="pub@acme.example", public_listing=True)
    private = _submit(
        name="Private Acme", email="priv@acme.example", public_listing=False
    )

    public_only = client.get("/applications?public_only=true")
    assert public_only.status_code == 200
    public_ids = {row["id"] for row in public_only.json()}
    assert public["id"] in public_ids
    assert private["id"] not in public_ids


def test_vet_pass_moves_status_to_trio_reviewing() -> None:
    a = _submit(email="vetpass@acme.example")
    r = client.post(
        f"/applications/{a['id']}/vet",
        json={
            "vet_status": "passed",
            "reasoning": "Aligned with human flourishing; APA-compatible.",
            "recommendation": "Recommend conditional acceptance.",
        },
    )
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["vet_status"] == "passed"
    assert out["status"] == "trio_reviewing"
    assert out["vet_at"] is not None


def test_vet_needs_revision_does_not_open_trio() -> None:
    a = _submit(email="vetrev@acme.example")
    r = client.post(
        f"/applications/{a['id']}/vet",
        json={
            "vet_status": "needs_revision",
            "reasoning": "Mission statement is vague.",
        },
    )
    assert r.status_code == 200
    assert r.json()["status"] == "vetted_revise"


def test_vet_reject_is_terminal() -> None:
    a = _submit(email="vetrej@acme.example")
    r = client.post(
        f"/applications/{a['id']}/vet",
        json={
            "vet_status": "rejected",
            "reasoning": "Mission is anti-flourishing.",
        },
    )
    assert r.status_code == 200
    assert r.json()["status"] == "vetted_reject"

    # Cannot vet again from a terminal state.
    r = client.post(
        f"/applications/{a['id']}/vet",
        json={"vet_status": "passed"},
    )
    assert r.status_code == 409


def test_review_rejects_non_trio_email() -> None:
    a = _submit(email="review-rej@acme.example")
    client.post(f"/applications/{a['id']}/vet", json={"vet_status": "passed"})

    r = client.post(
        f"/applications/{a['id']}/review",
        json={
            "reviewer_email": "stranger@somewhere.com",
            "vote": "yes",
            "comment": "I'd like to weigh in.",
        },
    )
    assert r.status_code == 403, r.text
    assert "trio" in r.json()["detail"].lower()


def test_review_accepts_trio_member_and_upserts() -> None:
    a = _submit(email="review-up@acme.example")
    client.post(f"/applications/{a['id']}/vet", json={"vet_status": "passed"})

    # First vote.
    r1 = client.post(
        f"/applications/{a['id']}/review",
        json={
            "reviewer_email": "freedom@thevrschool.org",
            "vote": "yes",
            "comment": "Strong mission alignment.",
        },
    )
    assert r1.status_code == 200, r1.text
    assert len(r1.json()["reviews"]) == 1
    assert r1.json()["reviews"][0]["vote"] == "yes"

    # Same reviewer changes their vote — upsert, NOT append.
    r2 = client.post(
        f"/applications/{a['id']}/review",
        json={
            "reviewer_email": "freedom@thevrschool.org",
            "vote": "maybe",
            "comment": "On reflection let me think more.",
        },
    )
    assert r2.status_code == 200
    assert len(r2.json()["reviews"]) == 1  # still one, not two
    assert r2.json()["reviews"][0]["vote"] == "maybe"


def test_review_email_is_case_insensitive_for_trio_match() -> None:
    a = _submit(email="review-case@acme.example")
    client.post(f"/applications/{a['id']}/vet", json={"vet_status": "passed"})

    # Reviewers' addresses are case-insensitive — the canonical
    # APA email (GCorea@apa.org) must resolve regardless of case.
    r = client.post(
        f"/applications/{a['id']}/review",
        json={
            "reviewer_email": "gcorea@APA.org",
            "vote": "yes",
            "comment": "Aligned with APA Principle E (Respect for Dignity).",
        },
    )
    assert r.status_code == 200, r.text


def test_finalize_requires_trio_reviewing_state() -> None:
    a = _submit(email="finalize-guard@acme.example")
    # Application is still in "submitted"; finalize must 409.
    r = client.post(
        f"/applications/{a['id']}/finalize",
        json={
            "final_decision": "conditionally_accepted",
            "final_reasoning": "Trio said yes.",
        },
    )
    assert r.status_code == 409


def test_full_happy_path_lands_at_conditionally_accepted() -> None:
    """submitted → vetted (pass) → 3 yes votes → conditionally_accepted."""
    a = _submit(email="happy@acme.example")

    client.post(
        f"/applications/{a['id']}/vet",
        json={
            "vet_status": "passed",
            "reasoning": "Looks great.",
            "recommendation": "Recommend conditional acceptance.",
        },
    )

    for email in (
        "freedom@thevrschool.org",
        "GCorea@apa.org",
        "ewojcicki@gmail.com",
    ):
        client.post(
            f"/applications/{a['id']}/review",
            json={
                "reviewer_email": email,
                "vote": "yes",
                "comment": f"Yes from {email}",
            },
        )

    final = client.post(
        f"/applications/{a['id']}/finalize",
        json={
            "final_decision": "conditionally_accepted",
            "final_reasoning": "All three reviewers said yes.",
        },
    )
    assert final.status_code == 200, final.text
    out = final.json()
    assert out["status"] == "conditionally_accepted"
    assert out["final_decision"] == "conditionally_accepted"
    assert out["final_decision_at"] is not None

    # Detail view shows all 3 reviews.
    detail = client.get(f"/applications/{a['id']}")
    assert detail.status_code == 200
    reviews = detail.json()["reviews"]
    assert len(reviews) == 3
    assert {r["vote"] for r in reviews} == {"yes"}


def test_submit_validates_min_length_on_pitch_fields() -> None:
    """Mission + APA statements have a 20-char floor (avoids one-word pitches)."""
    body = {
        "applicant_kind": "independent_agent",
        "applicant_name": "Test",
        "applicant_email": "test@example.com",
        "mission_statement": "short",
        "apa_statement": "this one is long enough to validate fine",
    }
    r = client.post("/applications", json=body)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Public-engagement: likes + comments
# ---------------------------------------------------------------------------


def _submit_public(email: str = "public@acme.example") -> dict:
    a = _submit(email=email, public_listing=True)
    assert a["public_listing"] is True
    assert a["likes_count"] == 0
    assert a["comments_count"] == 0
    return a


def test_like_only_works_on_public_listings() -> None:
    """Private (non-opt-in) applications can't accumulate community signal.

    Even when internal-auth is satisfied the route returns 403 when
    ``public_listing=False`` because the applicant didn't ask for public
    review. Tests run with INTERNAL_API_KEY unset so the auth gate is open;
    the 403 here comes from `_require_public`, not the auth dep.
    """
    a = _submit(email="private@acme.example", public_listing=False)
    r = client.post(
        f"/applications/{a['id']}/like",
        json={"user_id": "user:alice", "user_name": "Alice"},
    )
    assert r.status_code == 403, r.text
    detail = client.get(f"/applications/{a['id']}")
    assert detail.json()["likes_count"] == 0


def test_like_idempotent_double_like() -> None:
    a = _submit_public(email="like-idem@acme.example")
    body = {"user_id": "user:alice", "user_name": "Alice"}
    r1 = client.post(f"/applications/{a['id']}/like", json=body)
    r2 = client.post(f"/applications/{a['id']}/like", json=body)
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert r1.json()["likes_count"] == 1
    assert r2.json()["likes_count"] == 1


def test_likes_count_reflects_distinct_users() -> None:
    a = _submit_public(email="like-many@acme.example")
    for uid in ["user:alice", "user:bob", "user:carol"]:
        r = client.post(
            f"/applications/{a['id']}/like",
            json={"user_id": uid, "user_name": uid.split(":", 1)[1].title()},
        )
        assert r.status_code == 200
    detail = client.get(f"/applications/{a['id']}")
    assert detail.json()["likes_count"] == 3


def test_unlike_removes_like() -> None:
    a = _submit_public(email="unlike@acme.example")
    r = client.post(
        f"/applications/{a['id']}/like",
        json={"user_id": "user:alice", "user_name": "Alice"},
    )
    assert r.status_code == 200
    assert r.json()["likes_count"] == 1
    r2 = client.delete(f"/applications/{a['id']}/like?user_id=user:alice")
    assert r2.status_code == 200
    assert r2.json()["likes_count"] == 0


def test_comment_returns_201_and_is_listed() -> None:
    a = _submit_public(email="comment@acme.example")
    body = {
        "user_id": "user:alice",
        "user_name": "Alice",
        "body": "I think this agent's mission alignment is exemplary.",
    }
    r = client.post(f"/applications/{a['id']}/comments", json=body)
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["body"] == body["body"]
    assert out["user_id"] == body["user_id"]

    listed = client.get(f"/applications/{a['id']}/comments")
    assert listed.status_code == 200
    bodies = [c["body"] for c in listed.json()]
    assert body["body"] in bodies

    detail = client.get(f"/applications/{a['id']}")
    assert detail.json()["comments_count"] == 1
    assert detail.json()["comments"][0]["body"] == body["body"]


def test_comment_blocked_on_private_application() -> None:
    a = _submit(email="comment-private@acme.example", public_listing=False)
    r = client.post(
        f"/applications/{a['id']}/comments",
        json={"user_id": "user:alice", "user_name": "Alice", "body": "test"},
    )
    assert r.status_code == 403


def test_list_applications_includes_engagement_counts() -> None:
    a = _submit_public(email="counts-list@acme.example")
    client.post(
        f"/applications/{a['id']}/like",
        json={"user_id": "user:alice", "user_name": "Alice"},
    )
    client.post(
        f"/applications/{a['id']}/comments",
        json={"user_id": "user:bob", "user_name": "Bob", "body": "supportive note"},
    )
    listed = client.get("/applications?public_only=true").json()
    row = next(r for r in listed if r["id"] == a["id"])
    assert row["likes_count"] == 1
    assert row["comments_count"] == 1


# ---------------------------------------------------------------------------
# Phase 2b: contributions / impact metrics
# ---------------------------------------------------------------------------


def _force_status(application_id: int, status: str) -> None:
    """Reach into the DB and bump status without going through the proxy.

    Tests need an application past Devin's vet to log contributions, but
    the route is internal-auth gated and the test env has no key. We
    use the existing /vet route which transitions submitted →
    trio_reviewing on vet_status="passed".
    """
    r = client.post(
        f"/applications/{application_id}/vet",
        json={
            "vet_status": "passed",
            "reasoning": "stub",
            "recommendation": "stub",
        },
    )
    assert r.status_code == 200, r.text


def test_contribution_blocked_before_vet() -> None:
    a = _submit()
    r = client.post(
        f"/applications/{a['id']}/contributions",
        json={"kind": "challenge", "summary": "filed bug 12"},
    )
    assert r.status_code == 409


def test_contribution_logged_after_vet_pass() -> None:
    a = _submit()
    _force_status(a["id"], "trio_reviewing")
    r = client.post(
        f"/applications/{a['id']}/contributions",
        json={
            "kind": "challenge",
            "source_id": 42,
            "source_url": "https://sof.ai/challenges/42",
            "summary": "fixed flaky token parser",
            "weight": 1.5,
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["kind"] == "challenge"
    assert body["weight"] == 1.5
    assert body["source_url"] == "https://sof.ai/challenges/42"


def test_contribution_kind_validated() -> None:
    a = _submit()
    _force_status(a["id"], "trio_reviewing")
    r = client.post(
        f"/applications/{a['id']}/contributions",
        json={"kind": "evil", "summary": "whatever"},
    )
    assert r.status_code == 422


def test_list_contributions_returns_newest_first() -> None:
    a = _submit()
    _force_status(a["id"], "trio_reviewing")
    for kind, summary in [
        ("challenge", "first"),
        ("skill", "second"),
        ("article", "third"),
    ]:
        r = client.post(
            f"/applications/{a['id']}/contributions",
            json={"kind": kind, "summary": summary},
        )
        assert r.status_code == 201
    r = client.get(f"/applications/{a['id']}/contributions")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 3
    # Newest first (descending by created_at) — last logged ("third")
    # appears first.
    assert rows[0]["summary"] == "third"
    assert rows[-1]["summary"] == "first"


def test_detail_includes_impact_summary() -> None:
    a = _submit()
    _force_status(a["id"], "trio_reviewing")
    for kind, weight in [
        ("challenge", 1.0),
        ("challenge", 1.5),
        ("skill", 2.0),
        ("article", 1.0),
    ]:
        client.post(
            f"/applications/{a['id']}/contributions",
            json={"kind": kind, "summary": "x", "weight": weight},
        )
    r = client.get(f"/applications/{a['id']}")
    assert r.status_code == 200
    body = r.json()
    assert body["impact"]["total"] == 4
    assert body["impact"]["weighted"] == 5.5
    assert body["impact"]["by_kind"] == {
        "challenge": 2,
        "skill": 1,
        "article": 1,
    }
    assert len(body["contributions"]) == 4
