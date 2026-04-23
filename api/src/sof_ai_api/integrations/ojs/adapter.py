"""OJS federation adapter — mirrors sof.ai writes into an OJS instance.

Every ``mirror_*`` function is safe to call from a FastAPI ``BackgroundTasks``
worker:

* If the feature flag is off (``ojs_enabled()`` is False), the function
  returns immediately and does nothing.
* If the call succeeds, it updates the row's ``ojs_*_id`` and
  ``ojs_synced_at`` columns and commits.
* If the call fails, it records ``ojs_sync_error`` on the row so
  ``resync_pending`` (admin-gated endpoint) can retry later. Unless
  ``OJS_STRICT`` is set, the exception is swallowed.
"""

from __future__ import annotations

import logging

from sqlmodel import Session, select

from ...models import (
    Journal,
    JournalArticle,
    JournalIssue,
    JournalPeerReview,
    _utcnow,
)
from .client import OJSClient, OJSError
from .settings import ojs_enabled, ojs_settings

log = logging.getLogger("sof_ai_api.integrations.ojs")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _client() -> OJSClient:
    return OJSClient()


def _record_error(row: object, session: Session, exc: Exception) -> None:
    """Persist a sync error onto the row so operators can see what failed."""
    msg = str(exc)[:500]
    if hasattr(row, "ojs_sync_error"):
        row.ojs_sync_error = msg  # type: ignore[assignment]
        session.add(row)
        try:
            session.commit()
        except Exception:  # noqa: BLE001
            session.rollback()
    log.warning("ojs mirror failed: %s", msg)
    if ojs_settings().strict:
        raise exc


# ---------------------------------------------------------------------------
# Mirror functions — public API
# ---------------------------------------------------------------------------


def mirror_journal(session: Session, journal_id: int) -> bool:
    """Create (or re-use) the OJS context for this journal.

    Idempotent: if the row already has ``ojs_context_path`` set, does
    nothing. Returns True if a fresh mirror happened, False otherwise.
    """
    if not ojs_enabled():
        return False
    j = session.get(Journal, journal_id)
    if j is None:
        return False
    if j.ojs_context_path:
        return False

    try:
        resp = _client().create_context(
            {
                "urlPath": j.slug,
                "name": {"en": j.title},
                "description": {"en": j.description},
                "primaryLocale": "en",
                "enabled": True,
            }
        )
    except OJSError as exc:
        _record_error(j, session, exc)
        return False

    j.ojs_context_path = str(resp.get("urlPath") or j.slug)
    raw_id = resp.get("id")
    j.ojs_context_id = int(raw_id) if isinstance(raw_id, int) else None
    j.ojs_synced_at = _utcnow()
    j.ojs_sync_error = None
    session.add(j)
    session.commit()
    return True


def mirror_article(session: Session, article_id: int) -> bool:
    if not ojs_enabled():
        return False
    a = session.get(JournalArticle, article_id)
    if a is None or a.ojs_submission_id:
        return False

    # Make sure the parent context exists in OJS first.
    j = session.exec(
        select(Journal).where(Journal.slug == a.journal_slug)
    ).first()
    if j is None:
        return False
    if not j.ojs_context_path:
        mirror_journal(session, j.id or 0)
        session.refresh(j)
        if not j.ojs_context_path:
            return False

    try:
        resp = _client().create_submission(
            j.ojs_context_path,
            {
                "title": {"en": a.title},
                "abstract": {"en": a.abstract},
                "locale": "en",
                "sectionId": None,
                # OJS "coverLetter" is a natural fit for authors + coauthors.
                "coverLetter": {
                    "en": f"Submitter: {a.submitter_type}:{a.submitter_id}\n"
                    f"Coauthors: {a.coauthors}"
                },
            },
        )
    except OJSError as exc:
        _record_error(a, session, exc)
        return False

    raw_id = resp.get("id")
    a.ojs_submission_id = int(raw_id) if isinstance(raw_id, int) else None
    a.ojs_synced_at = _utcnow()
    a.ojs_sync_error = None
    session.add(a)
    session.commit()
    return True


def mirror_review(session: Session, review_id: int) -> bool:
    if not ojs_enabled():
        return False
    r = session.get(JournalPeerReview, review_id)
    if r is None or r.ojs_review_assignment_id:
        return False

    a = session.get(JournalArticle, r.article_id)
    if a is None or not a.ojs_submission_id:
        return False

    j = session.exec(
        select(Journal).where(Journal.slug == a.journal_slug)
    ).first()
    if j is None or not j.ojs_context_path:
        return False

    try:
        resp = _client().create_review_assignment(
            j.ojs_context_path,
            {
                "submissionId": a.ojs_submission_id,
                "reviewerDescription": (
                    f"{r.reviewer_type}:{r.reviewer_id} — "
                    f"{r.recommendation}"
                ),
                "comments": r.comments,
            },
        )
    except OJSError as exc:
        _record_error(r, session, exc)
        return False

    raw_id = resp.get("id")
    r.ojs_review_assignment_id = int(raw_id) if isinstance(raw_id, int) else None
    r.ojs_synced_at = _utcnow()
    r.ojs_sync_error = None
    session.add(r)
    session.commit()
    return True


def mirror_issue(session: Session, issue_id: int) -> bool:
    """Mirror a sof.ai issue to OJS in two phases: create, then publish.

    Each phase is independently retry-safe so a transient failure on
    ``publish_issue`` never leaves the issue unrecoverable:

    * Phase 1 (create): if ``ojs_issue_id`` is still ``NULL``, we call
      ``POST /issues``. On failure we record the error and bail — the
      row is still visible to ``resync_pending``'s create-phase filter.
    * Phase 2 (publish): runs whenever ``ojs_issue_id`` is set but the
      row still carries a sync error (or has never been marked synced).
      On failure we keep the ``ojs_issue_id`` and re-record the error,
      so the next ``resync_pending`` call picks the row up again via
      its publish-phase filter.

    A fully-mirrored row has ``ojs_issue_id IS NOT NULL`` **and**
    ``ojs_sync_error IS NULL`` **and** ``ojs_synced_at IS NOT NULL`` —
    any row that doesn't meet all three is eligible for retry.
    """
    if not ojs_enabled():
        return False
    i = session.get(JournalIssue, issue_id)
    if i is None:
        return False
    # Already fully synced — idempotent no-op.
    if i.ojs_issue_id and i.ojs_synced_at and not i.ojs_sync_error:
        return False

    j = session.exec(
        select(Journal).where(Journal.slug == i.journal_slug)
    ).first()
    if j is None or not j.ojs_context_path:
        return False

    # --- Phase 1: create the OJS issue if we haven't already. ---------------
    if i.ojs_issue_id is None:
        try:
            resp = _client().create_issue(
                j.ojs_context_path,
                {
                    "volume": i.volume,
                    "number": str(i.number),
                    "title": {
                        "en": i.title or f"Volume {i.volume}, Issue {i.number}"
                    },
                    "description": {"en": i.description},
                },
            )
        except OJSError as exc:
            _record_error(i, session, exc)
            return False

        raw_id = resp.get("id")
        if not isinstance(raw_id, int):
            _record_error(
                i, session, OJSError("OJS create_issue did not return an id")
            )
            return False
        i.ojs_issue_id = raw_id
        # Persist the id *before* we try to publish so that even if
        # publish_issue crashes hard (OOM / process kill) we don't leak a
        # second OJS issue on the next retry.
        session.add(i)
        session.commit()

    # --- Phase 2: publish. Always runs after a successful create and on any
    # retry where ojs_issue_id is set but we're not marked cleanly synced.
    try:
        _client().publish_issue(j.ojs_context_path, i.ojs_issue_id)
    except OJSError as exc:
        _record_error(i, session, exc)
        return False

    i.ojs_synced_at = _utcnow()
    i.ojs_sync_error = None
    session.add(i)
    session.commit()
    return True


# ---------------------------------------------------------------------------
# Retry — batch mirror everything currently un-synced.
# ---------------------------------------------------------------------------


def resync_pending(session: Session) -> dict[str, int]:
    """Push every row whose ``ojs_*_id`` is still null through the mirror.

    Called from ``POST /journals/_resync`` (admin-gated). Safe to run from
    operator CLI after first standing up an OJS instance to backfill
    existing sof.ai data.
    """
    if not ojs_enabled():
        return {
            "journals": 0,
            "articles": 0,
            "reviews": 0,
            "issues": 0,
            "skipped": 1,
        }

    journals = 0
    articles = 0
    reviews = 0
    issues = 0

    j_rows = session.exec(
        select(Journal).where(Journal.ojs_context_path.is_(None))  # type: ignore[union-attr]
    ).all()
    for j in j_rows:
        if j.id and mirror_journal(session, j.id):
            journals += 1

    a_rows = session.exec(
        select(JournalArticle).where(
            JournalArticle.ojs_submission_id.is_(None)  # type: ignore[union-attr]
        )
    ).all()
    for a in a_rows:
        if a.id and mirror_article(session, a.id):
            articles += 1

    r_rows = session.exec(
        select(JournalPeerReview).where(
            JournalPeerReview.ojs_review_assignment_id.is_(None)  # type: ignore[union-attr]
        )
    ).all()
    for r in r_rows:
        if r.id and mirror_review(session, r.id):
            reviews += 1

    # Issues are special: they go through create+publish, either of which
    # can fail on its own. Any row missing a final synced_at (or carrying
    # a persisted error) is a candidate for retry — mirror_issue itself
    # picks the correct phase based on the row's state.
    i_rows = session.exec(
        select(JournalIssue).where(
            (JournalIssue.ojs_synced_at.is_(None))  # type: ignore[union-attr]
            | (JournalIssue.ojs_sync_error.is_not(None))  # type: ignore[union-attr]
        )
    ).all()
    for i in i_rows:
        if i.id and mirror_issue(session, i.id):
            issues += 1

    return {
        "journals": journals,
        "articles": articles,
        "reviews": reviews,
        "issues": issues,
        "skipped": 0,
    }
