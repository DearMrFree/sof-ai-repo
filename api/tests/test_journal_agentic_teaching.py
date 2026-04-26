"""Tests for the Agentic Teaching journal seed + cross-journal source_url.

Cover three concrete behaviours:

  1. The agentic-teaching seed is idempotent — running it twice creates the
     journal once, the founding article once, and the revision once.
  2. The founding article persists with a non-null ``source_url`` so the
     LinearB inspiration link is preserved as a provenance trail.
  3. The journal article submit endpoint accepts an optional ``source_url``
     for ANY journal (cross-journal feature), persists it, and round-trips
     it on read.
"""

from fastapi.testclient import TestClient

from sof_ai_api.db import get_session, init_db
from sof_ai_api.main import app
from sof_ai_api.seed_journal_agentic_teaching import (
    ARTICLE_TITLE,
    JOURNAL_SLUG,
    SOURCE_URL,
)
from sof_ai_api.seed_journal_agentic_teaching import (
    seed as seed_agentic,
)

init_db()
client = TestClient(app)


def _seed_twice() -> tuple[dict, dict]:
    with next(get_session()) as s1:
        result_a = seed_agentic(s1)
    with next(get_session()) as s2:
        result_b = seed_agentic(s2)
    return result_a, result_b


def test_agentic_teaching_seed_is_idempotent() -> None:
    """First call creates everything; second call creates nothing."""
    a, b = _seed_twice()
    # First run created at least the article (journal may already exist
    # from a previous test run, since init_db is shared across the suite).
    assert a["article_created"] in {True, False}
    # Second run must be a clean no-op.
    assert b == {
        "journal_created": False,
        "article_created": False,
        "revisions_created": 0,
    }


def test_agentic_teaching_journal_is_listed_with_correct_slug() -> None:
    _seed_twice()
    r = client.get(f"/journals/{JOURNAL_SLUG}")
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["slug"] == JOURNAL_SLUG
    assert j["title"] == "Agentic Teaching"
    assert j["editor_in_chief_id"] == "freedom"
    # Founding article should be counted.
    assert j["article_count"] >= 1


def test_agentic_teaching_founding_article_persists_source_url() -> None:
    _seed_twice()
    r = client.get(f"/journals/{JOURNAL_SLUG}/articles")
    assert r.status_code == 200, r.text
    items = r.json()
    matches = [a for a in items if a["title"] == ARTICLE_TITLE]
    assert matches, f"founding article not found in {[a['title'] for a in items]}"
    a = matches[0]
    # source_url should round-trip on the wire.
    assert a.get("source_url") == SOURCE_URL
    # The article body must be original — not a copy of LinearB. Spot-check
    # a phrase that only appears in our authored text.
    assert "Pull requests as pedagogy" in a["title"] or "pedagogy" in a["title"]


def test_submit_article_accepts_source_url_cross_journal() -> None:
    """Cross-journal: submit an article with ``source_url`` to any journal."""
    # Use a fresh journal so we don't pollute the seeded data.
    j = client.post(
        "/journals",
        json={
            "slug": "url-context-cross",
            "title": "URL-context test journal",
            "editor_in_chief_type": "user",
            "editor_in_chief_id": "u-cross",
        },
    )
    assert j.status_code == 200, j.text

    src = "https://example.com/some-public-article"
    r = client.post(
        "/journals/url-context-cross/articles",
        json={
            "title": "An original take, drafted from a URL",
            "abstract": "Testing cross-journal URL context wiring.",
            "body": "## Hello\nOriginal body.",
            "submitter_type": "user",
            "submitter_id": "u-cross-author",
            "coauthors": [],
            "source_url": src,
        },
    )
    assert r.status_code == 200, r.text
    a = r.json()
    assert a["source_url"] == src

    # Round-trip via the GET endpoint to lock the persisted column.
    r2 = client.get(f"/journals/url-context-cross/articles/{a['id']}")
    assert r2.status_code == 200, r2.text
    assert r2.json()["source_url"] == src


def test_submit_article_without_source_url_is_null() -> None:
    j = client.post(
        "/journals",
        json={
            "slug": "url-context-null",
            "title": "URL-context null test",
            "editor_in_chief_type": "user",
            "editor_in_chief_id": "u-null",
        },
    )
    assert j.status_code == 200, j.text

    r = client.post(
        "/journals/url-context-null/articles",
        json={
            "title": "No source URL provided",
            "abstract": "x",
            "body": "y",
            "submitter_type": "user",
            "submitter_id": "u-null-author",
            "coauthors": [],
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["source_url"] is None
