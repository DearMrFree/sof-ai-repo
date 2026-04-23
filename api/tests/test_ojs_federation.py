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
        return {"id": sid}

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


def _enable_ojs(monkeypatch, fake: FakeOJSClient) -> None:
    """Flip the OJS feature flag on for this test and wire the fake client."""
    monkeypatch.setenv("OJS_BASE_URL", "https://ojs.sof.ai")
    monkeypatch.setenv("OJS_API_TOKEN", "fake-test-token")
    monkeypatch.setattr(adapter, "_client", lambda: fake)


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

        # Call order: context first, then submission.
        methods = [c[0] for c in fake.calls]
        assert methods == ["create_context", "create_submission"]


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


def test_mirror_issue_recovers_from_publish_failure(monkeypatch) -> None:
    """Two-phase mirror_issue: if create succeeds but publish fails, the
    row keeps its ``ojs_issue_id`` and records the publish error. The
    next ``resync_pending`` call must retry *only* the publish phase —
    never double-creating the OJS issue.
    """
    fake = FakeOJSClient()
    fake.fail_once_on = "publish_issue"
    _enable_ojs(monkeypatch, fake)

    with Session(engine) as s:
        j = _insert_journal(s, slug="publish-retry-test", eic="u-pr")
        # mirror_issue requires the parent context to already exist in OJS.
        assert adapter.mirror_journal(s, j.id or 0) is True
        s.refresh(j)
        i = JournalIssue(
            journal_slug=j.slug,
            volume=1,
            number=1,
            title="Publish retry",
            description="",
        )
        s.add(i)
        s.commit()
        s.refresh(i)

        # First attempt: create_issue succeeds, publish_issue raises.
        assert adapter.mirror_issue(s, i.id or 0) is False
        s.refresh(i)
        assert i.ojs_issue_id == 303  # create ran and persisted the id
        assert i.ojs_synced_at is None
        assert i.ojs_sync_error is not None
        assert "simulated publish_issue failure" in (i.ojs_sync_error or "")

        # The create-phase filter in resync_pending (ojs_issue_id IS NULL)
        # would *miss* this row — this is the exact bug Devin Review caught.
        # The publish-phase filter (ojs_synced_at IS NULL OR ojs_sync_error
        # IS NOT NULL) must pick it up instead.
        result = adapter.resync_pending(s)
        assert result["issues"] >= 1

        s.refresh(i)
        assert i.ojs_issue_id == 303  # unchanged — no second create happened
        assert i.ojs_synced_at is not None
        assert i.ojs_sync_error is None

        # Bookkeeping check: FakeOJSClient.create_issue was called exactly
        # once across both attempts, publish_issue was called twice
        # (first raised, second succeeded).
        create_calls = [c for c in fake.calls if c[0] == "create_issue"]
        publish_calls = [c for c in fake.calls if c[0] == "publish_issue"]
        assert len(create_calls) == 1
        assert len(publish_calls) == 2


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
