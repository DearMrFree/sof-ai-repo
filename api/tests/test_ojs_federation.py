"""Tests for the OJS federation adapter.

The adapter is **feature-flagged**: no ``OJS_BASE_URL`` / ``OJS_API_TOKEN``
env vars → every mirror function is a cheap no-op. With the flag on, we
monkey-patch the OJS client factory to return a fake that captures calls,
so the tests never reach the real network.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from sof_ai_api import settings as settings_module
from sof_ai_api.db import engine, init_db
from sof_ai_api.integrations.ojs import adapter
from sof_ai_api.integrations.ojs.client import OJSError
from sof_ai_api.main import app
from sof_ai_api.models import (
    Journal,
    JournalArticle,
    JournalIssue,
    JournalPeerReview,
)

init_db()
client = TestClient(app)


# ---------------------------------------------------------------------------
# Fake OJS client — mirrors the real OJSClient surface, captures calls.
# ---------------------------------------------------------------------------


class FakeOJSClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, Any, ...]] = []  # type: ignore[var-annotated]
        self.next_context_id = 42
        self.next_submission_id = 101
        self.next_review_id = 202
        self.next_issue_id = 303
        # If set, the first call to `target_method` raises this error.
        self.fail_once_on: str | None = None

    def _maybe_fail(self, method: str) -> None:
        if self.fail_once_on == method:
            self.fail_once_on = None
            raise OJSError(f"simulated {method} failure", status=503)

    def create_context(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.calls.append(("create_context", payload))
        self._maybe_fail("create_context")
        cid = self.next_context_id
        self.next_context_id += 1
        return {"id": cid, "urlPath": payload["urlPath"]}

    def create_submission(
        self, context_path: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        self.calls.append(("create_submission", context_path, payload))
        self._maybe_fail("create_submission")
        sid = self.next_submission_id
        self.next_submission_id += 1
        # OJS 3.4 always returns a single child publication on create;
        # the real client relies on this id for the follow-up PUT.
        pid = sid + 900
        return {"id": sid, "publications": [{"id": pid}]}

    def update_publication(
        self,
        context_path: str,
        submission_id: int,
        publication_id: int,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        self.calls.append(
            (
                "update_publication",
                context_path,
                submission_id,
                publication_id,
                payload,
            )
        )
        self._maybe_fail("update_publication")
        return {"id": publication_id, **payload}

    def create_review_assignment(
        self, context_path: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        self.calls.append(("create_review_assignment", context_path, payload))
        self._maybe_fail("create_review_assignment")
        rid = self.next_review_id
        self.next_review_id += 1
        return {"id": rid}

    def create_issue(
        self, context_path: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        self.calls.append(("create_issue", context_path, payload))
        self._maybe_fail("create_issue")
        iid = self.next_issue_id
        self.next_issue_id += 1
        return {"id": iid}

    def publish_issue(
        self, context_path: str, issue_id: int
    ) -> dict[str, Any]:
        self.calls.append(("publish_issue", context_path, issue_id))
        self._maybe_fail("publish_issue")
        return {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _FakeDB:
    """Captures direct-DB helper calls + hands out deterministic ids.

    The real direct-DB path in :mod:`adapter` runs a one-shot psycopg
    transaction against the OJS Postgres cluster. Unit tests stub the
    helper functions entirely so we can assert call shape + simulate
    failures without spinning up Postgres.
    """

    def __init__(self) -> None:
        self.issue_calls: list[dict] = []
        self.review_calls: list[dict] = []
        self.next_issue_id = 303
        self.next_review_id = 202
        # If set, the NEXT call to that kind fails (returns None).
        self.fail_once_on: str | None = None

    def create_and_publish_issue(
        self,
        *,
        context_id: int,
        volume: int,
        number: str,
        title: str,
        description: str,
        submission_ids: list[int],
    ) -> int | None:
        self.issue_calls.append(
            {
                "context_id": context_id,
                "volume": volume,
                "number": number,
                "title": title,
                "description": description,
                "submission_ids": submission_ids,
            }
        )
        if self.fail_once_on == "issue":
            self.fail_once_on = None
            return None
        iid = self.next_issue_id
        self.next_issue_id += 1
        return iid

    def create_review_assignment(
        self,
        *,
        submission_id: int,
        reviewer_type: str,
        reviewer_id_str: str,
        recommendation: str,
        comments: str,
    ) -> int | None:
        self.review_calls.append(
            {
                "submission_id": submission_id,
                "reviewer_type": reviewer_type,
                "reviewer_id_str": reviewer_id_str,
                "recommendation": recommendation,
                "comments": comments,
            }
        )
        if self.fail_once_on == "review":
            self.fail_once_on = None
            return None
        rid = self.next_review_id
        self.next_review_id += 1
        return rid


def _enable_ojs(
    monkeypatch,
    fake: FakeOJSClient,
    fake_db: _FakeDB | None = None,
) -> _FakeDB:
    """Flip the OJS feature flag on for this test and wire the fake client.

    Also stubs the direct-DB helpers so tests never touch Postgres. The
    real helpers run against ``OJS_DB_URL`` — out of scope for unit
    tests, covered by the live-deploy verification in PR #6/#7 instead.
    """
    monkeypatch.setenv("OJS_BASE_URL", "https://ojs.sof.ai")
    monkeypatch.setenv("OJS_API_TOKEN", "fake-test-token")
    monkeypatch.setattr(adapter, "_client", lambda: fake)
    monkeypatch.setattr(
        adapter,
        "_lookup_default_section_id",
        lambda context_id: (context_id or 0) + 1000,
    )
    db = fake_db or _FakeDB()
    monkeypatch.setattr(
        adapter, "_db_create_and_publish_issue", db.create_and_publish_issue
    )
    monkeypatch.setattr(
        adapter, "_db_create_review_assignment", db.create_review_assignment
    )
    return db


def _insert_journal(session: Session, slug: str, eic: str = "u-eic") -> Journal:
    j = Journal(
        slug=slug,
        title=f"Journal {slug}",
        description="Test journal",
        topic_tags="ai,test",
        editor_in_chief_type="user",
        editor_in_chief_id=eic,
    )
    session.add(j)
    session.commit()
    session.refresh(j)
    return j


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_mirror_functions_are_noop_when_ojs_disabled(monkeypatch) -> None:
    """With no OJS env vars, mirror_* functions must do nothing and return
    False — any module that accidentally requires OJS config would break
    every CI run, which is the whole point of the feature flag."""
    monkeypatch.delenv("OJS_BASE_URL", raising=False)
    monkeypatch.delenv("OJS_API_TOKEN", raising=False)

    with Session(engine) as s:
        j = _insert_journal(s, slug="noop-test")
        assert adapter.mirror_journal(s, j.id or 0) is False
        s.refresh(j)
        assert j.ojs_context_path is None
        assert j.ojs_synced_at is None


def test_mirror_journal_populates_ojs_columns(monkeypatch) -> None:
    fake = FakeOJSClient()
    _enable_ojs(monkeypatch, fake)

    with Session(engine) as s:
        j = _insert_journal(s, slug="mirror-journal-happy")
        assert adapter.mirror_journal(s, j.id or 0) is True
        s.refresh(j)

        assert j.ojs_context_path == "mirror-journal-happy"
        assert j.ojs_context_id == 42
        assert j.ojs_synced_at is not None
        assert j.ojs_sync_error is None

        # Second call is a no-op — already mirrored.
        assert adapter.mirror_journal(s, j.id or 0) is False
        # FakeOJSClient.create_context should only have been called once.
        ctx_calls = [c for c in fake.calls if c[0] == "create_context"]
        assert len(ctx_calls) == 1


def test_mirror_journal_records_error_on_failure(monkeypatch) -> None:
    fake = FakeOJSClient()
    fake.fail_once_on = "create_context"
    _enable_ojs(monkeypatch, fake)

    with Session(engine) as s:
        j = _insert_journal(s, slug="mirror-error-test")
        assert adapter.mirror_journal(s, j.id or 0) is False
        s.refresh(j)

        assert j.ojs_context_path is None
        assert j.ojs_sync_error is not None
        assert "simulated create_context failure" in (j.ojs_sync_error or "")

        # Retry after the failure is cleared — mirror should succeed and
        # clear the error.
        assert adapter.mirror_journal(s, j.id or 0) is True
        s.refresh(j)
        assert j.ojs_context_path == "mirror-error-test"
        assert j.ojs_sync_error is None


def test_mirror_article_chains_through_journal(monkeypatch) -> None:
    """Mirroring an article for an un-mirrored journal should first create
    the OJS context then the submission — the adapter handles the chain
    so callers never have to juggle ordering."""
    fake = FakeOJSClient()
    _enable_ojs(monkeypatch, fake)

    with Session(engine) as s:
        j = _insert_journal(s, slug="chain-test")
        a = JournalArticle(
            journal_slug=j.slug,
            title="Chain test article",
            abstract="",
            body="Body",
            submitter_type="user",
            submitter_id="u-author",
        )
        s.add(a)
        s.commit()
        s.refresh(a)

        assert adapter.mirror_article(s, a.id or 0) is True

        s.refresh(j)
        s.refresh(a)
        assert j.ojs_context_path == "chain-test"
        assert a.ojs_submission_id == 101
        assert a.ojs_synced_at is not None

        # Call order: context first, then submission, then the publication
        # PUT that sets title + abstract (OJS 3.4 submissions are two-phase).
        methods = [c[0] for c in fake.calls]
        assert methods == [
            "create_context",
            "create_submission",
            "update_publication",
        ]

        # The PUT body must carry the real title + abstract — if we ever
        # regress to sending them on ``create_submission`` we'd silently
        # create empty-titled papers in OJS.
        pub_call = next(c for c in fake.calls if c[0] == "update_publication")
        _, _, sid, pid, payload = pub_call
        assert sid == 101
        assert pid == 1001  # fake: pid = sid + 900
        assert payload["title"] == {"en": "Chain test article"}


def test_resync_pending_backfills_every_row(monkeypatch) -> None:
    fake = FakeOJSClient()
    _enable_ojs(monkeypatch, fake)

    with Session(engine) as s:
        j = _insert_journal(s, slug="resync-test", eic="u-resync")
        a = JournalArticle(
            journal_slug=j.slug,
            title="Resync article",
            abstract="",
            body="Body",
            submitter_type="user",
            submitter_id="u-a",
        )
        s.add(a)
        s.commit()
        s.refresh(a)
        r = JournalPeerReview(
            article_id=a.id or 0,
            reviewer_type="user",
            reviewer_id="u-reviewer",
            recommendation="accept",
            comments="LGTM",
        )
        i = JournalIssue(
            journal_slug=j.slug,
            volume=1,
            number=1,
            title="Vol 1 No 1",
            description="",
        )
        s.add(r)
        s.add(i)
        s.commit()

        # resync_pending backfills every un-synced row in the database; we
        # care that *our* new rows got through, not the absolute counts
        # (other tests in this module and seed data may leave un-synced
        # rows around).
        result = adapter.resync_pending(s)
        assert result["skipped"] == 0
        assert result["journals"] >= 1
        assert result["articles"] >= 1
        assert result["reviews"] >= 1
        assert result["issues"] >= 1

        still_pending = s.exec(
            select(Journal).where(Journal.slug == "resync-test")
        ).first()
        assert still_pending is not None
        assert still_pending.ojs_context_path == "resync-test"


def test_mirror_issue_retries_after_db_failure(monkeypatch) -> None:
    """Atomic direct-DB mirror_issue: on transient DB failure the row must
    stay un-synced (``ojs_issue_id IS NULL``) so resync picks it up again
    via the standard ``ojs_issue_id IS NULL`` filter, and a later retry
    must succeed without any double-insert risk (DB transaction is
    atomic — a failure rolls back every write, including the
    ``issue_settings`` rows and the ``journals.current_issue_id`` update).
    """
    fake = FakeOJSClient()
    fake_db = _FakeDB()
    fake_db.fail_once_on = "issue"
    _enable_ojs(monkeypatch, fake, fake_db=fake_db)

    with Session(engine) as s:
        j = _insert_journal(s, slug="db-retry-test", eic="u-dbr")
        # mirror_issue requires the parent context to already exist in OJS.
        assert adapter.mirror_journal(s, j.id or 0) is True
        s.refresh(j)
        i = JournalIssue(
            journal_slug=j.slug,
            volume=1,
            number=1,
            title="DB retry",
            description="",
        )
        s.add(i)
        s.commit()
        s.refresh(i)

        # First attempt: the DB helper returns None (simulated rollback).
        assert adapter.mirror_issue(s, i.id or 0) is False
        s.refresh(i)
        assert i.ojs_issue_id is None
        assert i.ojs_synced_at is None
        assert i.ojs_sync_error is not None
        assert "direct-DB issue insert failed" in (i.ojs_sync_error or "")

        # Resync: helper now succeeds, row lands cleanly.
        result = adapter.resync_pending(s)
        assert result["issues"] >= 1

        s.refresh(i)
        assert i.ojs_issue_id == 303
        assert i.ojs_synced_at is not None
        assert i.ojs_sync_error is None

        # Bookkeeping: helper called exactly twice (fail, then succeed),
        # and each call carried the correct context + volume + number.
        assert len(fake_db.issue_calls) == 2
        for call in fake_db.issue_calls:
            assert call["context_id"] == 42
            assert call["volume"] == 1
            assert call["number"] == "1"
            assert call["title"] == "DB retry"


def test_mirror_article_without_id_records_error_and_does_not_mark_synced(
    monkeypatch,
) -> None:
    """If OJS ``create_submission`` returns no int ``id``, we must NOT
    commit the row as synced — otherwise the next ``resync_pending``
    would re-submit via the ``ojs_submission_id IS NULL`` filter and
    silently create a duplicate OJS submission.
    """

    class IdlessClient(FakeOJSClient):
        def create_submission(
            self, context_path: str, payload: dict[str, Any]
        ) -> dict[str, Any]:
            self.calls.append(("create_submission", context_path, payload))
            return {}  # OJS returned 200 but no id — treat as a failure.

    fake = IdlessClient()
    _enable_ojs(monkeypatch, fake)

    with Session(engine) as s:
        j = _insert_journal(s, slug="article-no-id-test")
        a = JournalArticle(
            journal_slug=j.slug,
            title="No-id submission",
            abstract="",
            body="Body",
            submitter_type="user",
            submitter_id="u-a",
        )
        s.add(a)
        s.commit()
        s.refresh(a)

        assert adapter.mirror_article(s, a.id or 0) is False
        s.refresh(a)
        assert a.ojs_submission_id is None
        assert a.ojs_synced_at is None
        assert a.ojs_sync_error is not None
        assert "did not return an id" in (a.ojs_sync_error or "")

        # Key invariant: on resync the row must NOT be re-submitted to OJS
        # (that would be the duplication bug).
        calls_before = len(
            [c for c in fake.calls if c[0] == "create_submission"]
        )
        adapter.resync_pending(s)
        calls_after = len(
            [c for c in fake.calls if c[0] == "create_submission"]
        )
        # Resync will try again (that's the point) — but the retry still
        # fails with no-id, never succeeds, never marks as synced.
        assert calls_after == calls_before + 1
        s.refresh(a)
        assert a.ojs_synced_at is None


def test_mirror_review_without_id_records_error_and_does_not_mark_synced(
    monkeypatch,
) -> None:
    """If the direct-DB helper returns None (OJS_DB_URL unset, psycopg
    missing, FK violation, etc.), we must never mark the peer-review
    row synced. Otherwise resync's ``ojs_review_assignment_id IS NULL``
    filter would still pick it up, but ``ojs_synced_at IS NOT NULL``
    would lie about success, tripping up operators who inspect the row.
    """
    fake = FakeOJSClient()
    fake_db = _FakeDB()
    # Every review insert fails — not just the first one — because we
    # want to prove the row stays un-synced across retries when the DB
    # is permanently unreachable.
    fake_db.create_review_assignment = (  # type: ignore[assignment,method-assign]
        lambda **_kw: None
    )
    _enable_ojs(monkeypatch, fake, fake_db=fake_db)

    with Session(engine) as s:
        j = _insert_journal(s, slug="review-no-id-test")
        a = JournalArticle(
            journal_slug=j.slug,
            title="Article for no-id review",
            abstract="",
            body="Body",
            submitter_type="user",
            submitter_id="u-a",
        )
        s.add(a)
        s.commit()
        s.refresh(a)

        # Mirror the article so the review has a valid ojs_submission_id
        # to attach to — the bug we're testing lives in mirror_review.
        assert adapter.mirror_article(s, a.id or 0) is True
        s.refresh(a)
        assert a.ojs_submission_id is not None

        r = JournalPeerReview(
            article_id=a.id or 0,
            reviewer_type="user",
            reviewer_id="u-reviewer",
            recommendation="accept",
            comments="LGTM",
        )
        s.add(r)
        s.commit()
        s.refresh(r)

        assert adapter.mirror_review(s, r.id or 0) is False
        s.refresh(r)
        assert r.ojs_review_assignment_id is None
        assert r.ojs_synced_at is None
        assert r.ojs_sync_error is not None
        assert "direct-DB review insert failed" in (r.ojs_sync_error or "")


def test_ojs_status_endpoint_reports_flag(monkeypatch) -> None:
    monkeypatch.delenv("OJS_BASE_URL", raising=False)
    monkeypatch.delenv("OJS_API_TOKEN", raising=False)
    r = client.get("/journals/_ojs/status")
    assert r.status_code == 200
    assert r.json() == {"enabled": False}

    monkeypatch.setenv("OJS_BASE_URL", "https://ojs.sof.ai")
    monkeypatch.setenv("OJS_API_TOKEN", "x")
    r = client.get("/journals/_ojs/status")
    assert r.status_code == 200
    assert r.json() == {"enabled": True}


def test_ojs_resync_endpoint_requires_internal_auth(monkeypatch) -> None:
    """Admin-gated — anonymous callers must be rejected.

    The settings singleton is cached at import time, so we monkey-patch
    ``settings.internal_api_key`` directly rather than setting the env
    var (which would be a no-op by that point).
    """
    monkeypatch.setattr(
        settings_module.settings, "internal_api_key", "super-secret-ci-key"
    )
    r = client.post("/journals/_ojs/resync")
    assert r.status_code == 401

    # Correct header gets through.
    r = client.post(
        "/journals/_ojs/resync",
        headers={"X-Internal-Auth": "super-secret-ci-key"},
    )
    assert r.status_code == 200
