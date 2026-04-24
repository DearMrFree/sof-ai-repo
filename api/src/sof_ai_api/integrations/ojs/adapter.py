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
from typing import Optional

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


def _lookup_default_section_id(context_id: int) -> Optional[int]:
    """Query OJS's Postgres directly for the first section of a context.

    OJS 3.4's REST API does not expose ``/sections`` at context scope (the
    endpoint is simply not registered — only ``/submissions``, ``/issues``,
    ``/users`` etc.), and submissions require a ``sectionId``. OJS creates
    exactly one default section per context at ``mirror_journal`` time, so
    a direct DB lookup is both safe and sufficient. If ``OJS_DB_URL`` is
    unset, returns None and the caller records a sync error.
    """
    db_url = ojs_settings().db_url
    if not db_url:
        return None
    try:
        # Lazy import so environments without the ``postgres`` extra still
        # boot — e.g. the unit test suite, which uses SQLite. Top-level
        # import would pull psycopg in unconditionally and break CI there.
        import psycopg  # type: ignore[import-not-found]  # noqa: PLC0415
    except ImportError:  # pragma: no cover — psycopg is in the postgres extra.
        log.warning("OJS_DB_URL is set but psycopg is not installed")
        return None
    try:
        with psycopg.connect(db_url, connect_timeout=5) as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT section_id FROM sections "
                "WHERE journal_id = %s ORDER BY seq, section_id LIMIT 1",
                (context_id,),
            )
            row = cur.fetchone()
            return int(row[0]) if row else None
    except Exception as exc:  # noqa: BLE001
        log.warning("OJS default-section lookup failed: %s", exc)
        return None


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

    Idempotent across two independent dimensions:

    * ``ojs_context_path`` — if unset, we create the context in OJS.
    * ``ojs_default_section_id`` — if unset (regardless of whether the
      context row is fresh), we look it up via the OJS Postgres cache and
      persist it. This lets us backfill the section-id on journals that
      were mirrored before we started tracking it.

    Returns True if any field was populated, False otherwise.
    """
    if not ojs_enabled():
        return False
    j = session.get(Journal, journal_id)
    if j is None:
        return False
    # Skip the create call only when the context already exists *and* we
    # have the section id cached. Otherwise we still want to run the
    # section-id lookup below for backfill.
    if j.ojs_context_path and j.ojs_default_section_id is not None:
        return False

    changed = False

    if not j.ojs_context_path:
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
        changed = True

    # Resolve + cache the default section id. Falls back silently when
    # OJS_DB_URL isn't configured — mirror_article will record a clear
    # "sectionId unknown" error instead.
    if j.ojs_context_id is not None and j.ojs_default_section_id is None:
        sec_id = _lookup_default_section_id(j.ojs_context_id)
        if sec_id is not None:
            j.ojs_default_section_id = sec_id
            changed = True

    if changed:
        j.ojs_synced_at = _utcnow()
        j.ojs_sync_error = None
        session.add(j)
        session.commit()
    return changed


def mirror_article(session: Session, article_id: int) -> bool:  # noqa: PLR0911, PLR0912
    # The guard returns are load-bearing: flag-off, missing row, already-
    # synced, missing parent journal, failed parent mirror, OJS call
    # failed, and OJS returned no id are all distinct "bail early" paths.
    if not ojs_enabled():
        return False
    a = session.get(JournalArticle, article_id)
    if a is None or a.ojs_submission_id is not None:
        return False

    # Make sure the parent context exists in OJS first and that we know
    # its default section id. Both are set by mirror_journal.
    j = session.exec(
        select(Journal).where(Journal.slug == a.journal_slug)
    ).first()
    if j is None:
        return False
    if not j.ojs_context_path or j.ojs_default_section_id is None:
        mirror_journal(session, j.id or 0)
        session.refresh(j)
        if not j.ojs_context_path:
            return False
    if j.ojs_default_section_id is None:
        _record_error(
            a,
            session,
            OJSError(
                "OJS default sectionId is unknown — set OJS_DB_URL so the "
                "adapter can look it up for this context."
            ),
        )
        return False

    # --- Phase 1: create the empty submission. -----------------------------
    # OJS 3.4 rejects any POST that tries to set title/abstract/
    # submissionProgress at creation time — those live on the child
    # publication, which is the next call. We also MUST pass sectionId +
    # locale; everything else is managed by the workflow.
    try:
        resp = _client().create_submission(
            j.ojs_context_path,
            {
                "locale": "en",
                "sectionId": j.ojs_default_section_id,
            },
        )
    except OJSError as exc:
        _record_error(a, session, exc)
        return False

    raw_id = resp.get("id")
    if not isinstance(raw_id, int):
        # Never mark synced without an id. If we did, `ojs_submission_id`
        # would be NULL but `ojs_synced_at` would be set, and the next
        # resync_pending call would re-submit via the `is_(None)` filter
        # (plus the idempotency guard in mirror_article would not skip
        # it either) — silently creating a duplicate OJS submission.
        _record_error(
            a, session, OJSError("OJS create_submission did not return an id")
        )
        return False

    # Pull the just-created publication id off the response. Every fresh
    # submission ships with exactly one publication. We persist the
    # submission id *before* attempting the publication PUT so a crash in
    # phase 2 doesn't leak an invisible duplicate on the next resync.
    pub_id: Optional[int] = None
    for pub in resp.get("publications") or []:
        if isinstance(pub, dict):
            pid = pub.get("id")
            if isinstance(pid, int):
                pub_id = pid
                break
    a.ojs_submission_id = raw_id
    session.add(a)
    session.commit()

    if pub_id is None:
        _record_error(
            a,
            session,
            OJSError(
                "OJS create_submission returned no publications[] — cannot "
                "write title/abstract; manual intervention required."
            ),
        )
        return False

    # --- Phase 2: set title/abstract on the publication. -------------------
    try:
        _client().update_publication(
            j.ojs_context_path,
            raw_id,
            pub_id,
            {
                "title": {"en": a.title},
                "abstract": {"en": a.abstract},
                # ``coverage`` is the idiomatic OJS field for a free-form
                # context blurb; we use it to carry submitter + coauthor
                # attribution so the OJS-side reader can see who wrote it
                # without needing to reach back into the sof.ai API.
                "coverage": {
                    "en": f"Submitter: {a.submitter_type}:{a.submitter_id}"
                    + (f" | Coauthors: {a.coauthors}" if a.coauthors else "")
                },
            },
        )
    except OJSError as exc:
        _record_error(a, session, exc)
        return False

    a.ojs_synced_at = _utcnow()
    a.ojs_sync_error = None
    session.add(a)
    session.commit()
    return True


def mirror_review(session: Session, review_id: int) -> bool:  # noqa: PLR0911
    # Same rationale as mirror_article: each guard return represents a
    # distinct "don't mirror this row right now" precondition.
    if not ojs_enabled():
        return False
    r = session.get(JournalPeerReview, review_id)
    if r is None or r.ojs_review_assignment_id is not None:
        return False

    a = session.get(JournalArticle, r.article_id)
    if a is None or a.ojs_submission_id is None:
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
    if not isinstance(raw_id, int):
        # Same reasoning as mirror_article: without an id we'd silently
        # create a duplicate OJS review assignment on the next resync.
        _record_error(
            r,
            session,
            OJSError("OJS create_review_assignment did not return an id"),
        )
        return False
    r.ojs_review_assignment_id = raw_id
    r.ojs_synced_at = _utcnow()
    r.ojs_sync_error = None
    session.add(r)
    session.commit()
    return True


def mirror_issue(session: Session, issue_id: int) -> bool:  # noqa: PLR0911
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
    # Already fully synced — idempotent no-op. Using ``is not None``
    # rather than truthiness so a hypothetical ``id: 0`` from OJS doesn't
    # slip through and loop phase 2 forever (the docstring's "IS NOT
    # NULL" invariant is the canonical spelling).
    if (
        i.ojs_issue_id is not None
        and i.ojs_synced_at is not None
        and not i.ojs_sync_error
    ):
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
