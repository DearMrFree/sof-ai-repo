"""Tests for the Journalism School of AI / OJS-aligned journals module."""

from fastapi.testclient import TestClient

from sof_ai_api.db import init_db
from sof_ai_api.main import app

init_db()
client = TestClient(app)


def _found_journal(
    slug: str = "agentic-methods",
    eic: str = "u-editor",
) -> dict:
    r = client.post(
        "/journals",
        json={
            "slug": slug,
            "title": "Journal of Agentic Methods",
            "description": "Peer-reviewed work on agent collaboration in education.",
            "topic_tags": ["agents", "education", "ai"],
            "editor_in_chief_type": "user",
            "editor_in_chief_id": eic,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_found_journal_credits_editor_in_chief() -> None:
    j = _found_journal(slug="agentic-methods-eic")
    assert j["slug"] == "agentic-methods-eic"
    assert j["editor_in_chief_id"] == "u-editor"

    w = client.get("/wallet/user/u-editor").json()
    # signup bonus is not triggered for journal founding — only 300 EDU payout.
    assert w["balance"] >= 300


def test_found_journal_slug_conflict_returns_409() -> None:
    _found_journal(slug="duplicate-slug")
    r = client.post(
        "/journals",
        json={
            "slug": "duplicate-slug",
            "title": "Another One",
            "editor_in_chief_type": "user",
            "editor_in_chief_id": "u-other",
        },
    )
    assert r.status_code == 409


def test_submit_article_credits_submitter_and_appears_in_listing() -> None:
    j = _found_journal(slug="submit-test")

    r = client.post(
        f"/journals/{j['slug']}/articles",
        json={
            "title": "On the two-sided classroom",
            "abstract": "A study of co-learning between humans and agents.",
            "body": "## Introduction\n...",
            "submitter_type": "user",
            "submitter_id": "u-author",
            "coauthors": ["agent:devin", "agent:claude"],
        },
    )
    assert r.status_code == 200, r.text
    a = r.json()
    assert a["status"] == "submitted"
    assert a["coauthors"] == ["agent:devin", "agent:claude"]

    w = client.get("/wallet/user/u-author").json()
    assert w["balance"] >= 50

    listing = client.get(f"/journals/{j['slug']}/articles").json()
    assert any(art["id"] == a["id"] for art in listing)


def test_peer_review_forbids_self_review() -> None:
    j = _found_journal(slug="self-review-test", eic="u-editor-2")
    a = client.post(
        f"/journals/{j['slug']}/articles",
        json={
            "title": "Self review test",
            "submitter_type": "user",
            "submitter_id": "u-author-self",
        },
    ).json()

    bad = client.post(
        f"/journals/{j['slug']}/articles/{a['id']}/reviews",
        json={
            "reviewer_type": "user",
            "reviewer_id": "u-author-self",
            "recommendation": "accept",
        },
    )
    assert bad.status_code == 400


def test_peer_review_is_deduped_per_reviewer() -> None:
    j = _found_journal(slug="dedupe-test", eic="u-editor-3")
    a = client.post(
        f"/journals/{j['slug']}/articles",
        json={
            "title": "Dedupe test",
            "submitter_type": "user",
            "submitter_id": "u-author-dd",
        },
    ).json()

    r1 = client.post(
        f"/journals/{j['slug']}/articles/{a['id']}/reviews",
        json={
            "reviewer_type": "user",
            "reviewer_id": "u-reviewer",
            "recommendation": "minor_revisions",
            "comments": "nice work",
        },
    )
    assert r1.status_code == 200, r1.text

    r2 = client.post(
        f"/journals/{j['slug']}/articles/{a['id']}/reviews",
        json={
            "reviewer_type": "user",
            "reviewer_id": "u-reviewer",
            "recommendation": "accept",
        },
    )
    assert r2.status_code == 409, "uq_peer_review_reviewer should reject"

    w = client.get("/wallet/user/u-reviewer").json()
    assert w["balance"] == 75, "peer_review payout should fire exactly once"


def test_publish_issue_flips_articles_and_pays_eic_and_authors() -> None:
    j = _found_journal(slug="publish-test", eic="u-editor-4")
    a = client.post(
        f"/journals/{j['slug']}/articles",
        json={
            "title": "Publishing pipeline",
            "submitter_type": "user",
            "submitter_id": "u-author-pub",
        },
    ).json()

    eic_before = client.get("/wallet/user/u-editor-4").json()["balance"]
    author_before = client.get("/wallet/user/u-author-pub").json()["balance"]

    r = client.post(
        f"/journals/{j['slug']}/issues",
        json={
            "volume": 1,
            "number": 1,
            "title": "Inaugural issue",
            "article_ids": [a["id"]],
        },
    )
    assert r.status_code == 200, r.text
    issue = r.json()
    assert issue["published_article_ids"] == [a["id"]]

    art = client.get(f"/journals/{j['slug']}/articles/{a['id']}").json()
    assert art["status"] == "published"
    assert art["published_issue_id"] == issue["id"]

    eic_after = client.get("/wallet/user/u-editor-4").json()["balance"]
    author_after = client.get("/wallet/user/u-author-pub").json()["balance"]
    assert eic_after - eic_before == 150, "issue_published payout"
    assert author_after - author_before == 120, "article_published payout"


def test_seed_journal_ai_is_idempotent_and_creates_founding_article() -> None:
    """The Journal AI seed must create a journal, founding article, peer
    reviews, and volume 1 issue 1 on first run — and be a cheap no-op on
    subsequent runs. This is the lifespan-startup hook that plants the
    flagship journal on every cold boot."""
    from sof_ai_api.db import get_session
    from sof_ai_api.seed_journal_ai import (
        ARTICLE_TITLE,
        JOURNAL_SLUG,
        PEER_REVIEWS,
        REVISIONS,
        seed,
    )

    # Fresh run should create everything.
    s1 = next(get_session())
    first = seed(s1)
    s1.close()
    assert first["journal_slug"] == JOURNAL_SLUG
    # Could be created=True if first time, or False if prior tests triggered
    # the lifespan seed. Either way the flags + counts should be consistent.
    assert isinstance(first["article_id"], int)

    # Second run is a no-op.
    s2 = next(get_session())
    second = seed(s2)
    s2.close()
    assert second["journal_created"] is False
    assert second["article_created"] is False
    assert second["issue_created"] is False
    assert second["revisions_created"] == 0
    assert second["reviews_created"] == 0

    # Article should be fetchable from the public API.
    article = client.get(
        f"/journals/{JOURNAL_SLUG}/articles/{first['article_id']}"
    ).json()
    assert article["title"] == ARTICLE_TITLE
    assert article["status"] == "published"
    # Co-authored with Devin.
    assert "agent:devin" in article["coauthors"]

    # All seeded peer reviews should be present.
    reviews = client.get(
        f"/journals/{JOURNAL_SLUG}/articles/{first['article_id']}/reviews"
    ).json()
    assert len(reviews) == len(PEER_REVIEWS)
    # Includes at least one agent review (Claude) and one human review.
    kinds = {(r["reviewer_type"], r["reviewer_id"]) for r in reviews}
    assert ("agent", "claude") in kinds
    assert ("user", "ada") in kinds

    # Revisions endpoint exposes the evolving-document history.
    revs = client.get(
        f"/journals/{JOURNAL_SLUG}/articles/{first['article_id']}/revisions"
    ).json()
    assert len(revs) == len(REVISIONS)
    assert revs[0]["revision_no"] == 1
    assert revs[-1]["revision_no"] == len(REVISIONS)


def test_publish_issue_rejects_duplicate_volume_number() -> None:
    j = _found_journal(slug="dup-issue-test", eic="u-editor-5")
    client.post(
        f"/journals/{j['slug']}/issues",
        json={"volume": 1, "number": 1, "title": "v1"},
    )
    dup = client.post(
        f"/journals/{j['slug']}/issues",
        json={"volume": 1, "number": 1, "title": "v1 again"},
    )
    assert dup.status_code == 409
