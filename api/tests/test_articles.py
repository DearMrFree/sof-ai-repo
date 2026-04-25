"""Tests for the Living-Article Pipeline routes (PR #10).

Coverage:
  * idempotency on session_id (no duplicate articles per chat thread)
  * forced author ordering (Freedom always 1, Devin always 2; Claude/Gemini
    are dropped from coauthors and never authored)
  * pipeline phase advancement creates ArticleReviewRound rows
  * approve route requires Dr. Cheteni's email (others 403)
  * legacy non-pipeline articles are NOT returned by GET /articles
"""

from fastapi.testclient import TestClient

from sof_ai_api.db import init_db
from sof_ai_api.main import app

init_db()
client = TestClient(app)


def _start(
    session_id: str = "sess-pipeline-1",
    coauthors: list[dict] | None = None,
    transcript: list[dict] | None = None,
) -> dict:
    body = {
        "session_id": session_id,
        "agent_id": "devin",
        "primary_author": {
            "type": "user",
            "id": "freedom",
            "display_name": "Dr. Freedom Cheteni",
        },
        "coauthors": coauthors or [],
        "transcript": transcript
        or [
            {"role": "user", "content": "Build me a new feature"},
            {"role": "assistant", "content": "On it. Branching now."},
            {"role": "user", "content": "Great, ship it"},
        ],
        "title_hint": "Auto-test article",
    }
    r = client.post("/articles/start", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_start_creates_draft_with_canonical_authors() -> None:
    a = _start(session_id="sess-canonical-1")
    assert a["pipeline_phase"] == "drafted"
    assert a["status"] == "draft"
    # Position 1 is always Freedom.
    assert a["primary_author"]["id"] == "freedom"
    assert a["primary_author"]["type"] == "user"
    # Position 2 is always Devin.
    assert a["coauthors"][0]["id"] == "devin"
    assert a["coauthors"][0]["type"] == "agent"


def test_start_is_idempotent_on_session_id() -> None:
    a1 = _start(session_id="sess-idem-1")
    a2 = _start(session_id="sess-idem-1")
    assert a1["id"] == a2["id"], "duplicate article spawned on retry"


def test_claude_and_gemini_are_dropped_from_coauthors() -> None:
    a = _start(
        session_id="sess-no-reviewers",
        coauthors=[
            {"type": "agent", "id": "claude"},
            {"type": "agent", "id": "gemini"},
            {"type": "user", "id": "u-helper", "display_name": "Helper"},
        ],
    )
    coauthor_ids = [c["id"] for c in a["coauthors"]]
    assert "claude" not in coauthor_ids
    assert "gemini" not in coauthor_ids
    # Devin always second; the user helper follows.
    assert coauthor_ids[0] == "devin"
    assert "u-helper" in coauthor_ids


def test_pipeline_advance_records_review_rounds() -> None:
    a = _start(session_id="sess-advance-1")
    aid = a["id"]

    # Advance: drafted → claude_review_1 (no round recorded; current phase
    # was drafted, not an agent phase).
    r1 = client.post(
        f"/articles/{aid}/advance",
        json={"actor_user_id": "system", "summary": "begin pipeline"},
    )
    assert r1.status_code == 200
    assert r1.json()["pipeline_phase"] == "claude_review_1"

    # Advance: claude_review_1 → devin_review_1 (Claude's review recorded).
    r2 = client.post(
        f"/articles/{aid}/advance",
        json={
            "actor_user_id": "system",
            "summary": "Tightened the abstract; polished tone",
            "body": "## Claude's pass\\n- abstract reworded for clarity\\n",
        },
    )
    assert r2.status_code == 200
    assert r2.json()["pipeline_phase"] == "devin_review_1"

    detail = client.get(f"/articles/{aid}").json()
    rounds = detail["reviews"]
    assert len(rounds) == 1, "exactly one review round expected after Claude's pass"
    assert rounds[0]["reviewer_id"] == "claude"
    assert rounds[0]["phase"] == "claude_review_1"
    assert rounds[0]["round_no"] == 1
    assert "abstract" in rounds[0]["body"]


def test_approve_requires_freedom_email() -> None:
    a = _start(session_id="sess-approval-gate-1")
    aid = a["id"]
    # Walk to awaiting_approval (drafted → claude → devin → claude → gemini
    # → devin → awaiting_approval).
    for _ in range(6):
        client.post(
            f"/articles/{aid}/advance",
            json={"actor_user_id": "system", "summary": "step"},
        )
    cur = client.get(f"/articles/{aid}").json()
    assert cur["pipeline_phase"] == "awaiting_approval"

    # Wrong approver → 403.
    bad = client.post(
        f"/articles/{aid}/approve",
        json={"approver_email": "someone@else.com"},
    )
    assert bad.status_code == 403

    # Right approver → 200, status flips to published.
    good = client.post(
        f"/articles/{aid}/approve",
        json={"approver_email": "freedom@thevrschool.org"},
    )
    assert good.status_code == 200
    out = good.json()
    assert out["pipeline_phase"] == "published"
    assert out["status"] == "published"
    assert out["published_at"] is not None


def test_approve_rejects_premature_articles() -> None:
    """An article still in drafted/review phases must not be approvable —
    only awaiting_approval can be approved (this prevents bypassing the
    review chain entirely)."""
    a = _start(session_id="sess-premature-1")
    r = client.post(
        f"/articles/{a['id']}/approve",
        json={"approver_email": "freedom@thevrschool.org"},
    )
    assert r.status_code == 409


def test_list_articles_excludes_legacy_non_pipeline_rows() -> None:
    """Articles created via the legacy /journals/{slug}/articles route
    have pipeline_phase=NULL; they must NOT appear in the pipeline UI."""
    # Make a pipeline article so the listing isn't empty.
    _start(session_id="sess-list-mixin-1")
    rows = client.get("/articles").json()
    assert all(r["pipeline_phase"] is not None for r in rows)


def test_unknown_article_returns_404() -> None:
    r = client.get("/articles/99999")
    assert r.status_code == 404
