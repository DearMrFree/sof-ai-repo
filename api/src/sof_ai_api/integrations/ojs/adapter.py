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


def _psycopg_or_none():  # type: ignore[no-untyped-def]
    """Lazy-import psycopg so environments without the ``postgres`` extra
    (e.g. the unit test suite, which uses SQLite) still boot. A top-level
    import would pull psycopg in unconditionally and break CI there.

    Returns the psycopg module, or None when it isn't installed.
    """
    try:
        import psycopg  # type: ignore[import-not-found]  # noqa: PLC0415
    except ImportError:  # pragma: no cover — psycopg is in the postgres extra.
        log.warning("OJS_DB_URL is set but psycopg is not installed")
        return None
    return psycopg


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
    psycopg = _psycopg_or_none()
    if psycopg is None:
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


def _lookup_admin_user_id() -> Optional[int]:
    """Return the OJS admin user_id via a direct Postgres lookup.

    Agent reviewers on sof.ai don't exist as OJS ``users`` rows, but
    ``review_assignments.reviewer_id`` is a NOT NULL FK into ``users``.
    The cleanest mapping is: every sof.ai reviewer attributes to the
    OJS admin account, and the real reviewer identity + verdict + body
    travel in ``review_assignments.competing_interests`` (a free-form
    text column) so editors see everything in OJS without us having to
    fabricate user accounts for every agent.

    Returns None when ``OJS_DB_URL`` is unset or the query fails.
    """
    db_url = ojs_settings().db_url
    if not db_url:
        return None
    psycopg = _psycopg_or_none()
    if psycopg is None:
        return None
    try:
        with psycopg.connect(db_url, connect_timeout=5) as conn, conn.cursor() as cur:
            cur.execute("SELECT user_id FROM users ORDER BY user_id LIMIT 1")
            row = cur.fetchone()
            return int(row[0]) if row else None
    except Exception as exc:  # noqa: BLE001
        log.warning("OJS admin user lookup failed: %s", exc)
        return None


def _db_create_and_publish_issue(
    context_id: int,
    volume: int,
    number: str,
    title: str,
    description: str,
    submission_ids: list[int],
) -> Optional[int]:
    """Create + publish an OJS issue via a single Postgres transaction.

    OJS 3.4's REST API does not register ``POST /issues`` — the
    ``IssueHandler`` class only exposes GET routes, so writes must go
    directly to Postgres. In one transaction we:

    1. Insert an ``issues`` row (``published=1``, ``date_published=now()``).
    2. Insert title + description into ``issue_settings``.
    3. Update the parent journal's ``current_issue_id`` so the issue
       shows up on OJS's reader-facing ``/current`` page.
    4. For every submission in ``submission_ids``: set ``publication_settings``
       ``issueId``, flip ``publications.status`` to 3 (STATUS_PUBLISHED),
       and stamp ``date_published``.

    Returns the new ``issue_id`` on success, or None when ``OJS_DB_URL``
    is unset / the transaction fails. Failures are rolled back atomically
    so a partial insert can never leave OJS half-federated.
    """
    db_url = ojs_settings().db_url
    if not db_url:
        return None
    psycopg = _psycopg_or_none()
    if psycopg is None:
        return None
    try:
        with psycopg.connect(db_url, connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO issues (
                        journal_id, volume, number, year, published,
                        show_volume, show_number, show_year, show_title,
                        access_status, date_notified, last_modified,
                        date_published
                    ) VALUES (
                        %s, %s, %s, %s, 1,
                        1, 1, 1, 1,
                        1, now(), now(), now()
                    ) RETURNING issue_id
                    """,
                    (context_id, volume, number, _utcnow().year),
                )
                row = cur.fetchone()
                if row is None:
                    conn.rollback()
                    return None
                issue_id = int(row[0])

                cur.executemany(
                    "INSERT INTO issue_settings "
                    "(issue_id, locale, setting_name, setting_value) "
                    "VALUES (%s, 'en', %s, %s)",
                    [
                        (issue_id, "title", title),
                        (issue_id, "description", description or ""),
                    ],
                )

                cur.execute(
                    "UPDATE journals SET current_issue_id = %s "
                    "WHERE journal_id = %s",
                    (issue_id, context_id),
                )

                # Attach every already-mirrored article to the new issue.
                # OJS derives the /current page TOC from these three writes:
                # publication_settings.issueId, publications.status,
                # publications.date_published. Without them the issue exists
                # but reads as empty. We update every publication whose
                # submission_id is in the batch, which handles multi-version
                # papers naturally (all versions point at the same issue).
                for sid in submission_ids:
                    cur.execute(
                        "SELECT publication_id FROM publications "
                        "WHERE submission_id = %s",
                        (sid,),
                    )
                    for (pub_id,) in cur.fetchall():
                        cur.execute(
                            """
                            INSERT INTO publication_settings
                                (publication_id, locale, setting_name,
                                 setting_value)
                            VALUES (%s, '', 'issueId', %s)
                            ON CONFLICT (publication_id, locale, setting_name)
                            DO UPDATE SET setting_value = EXCLUDED.setting_value
                            """,
                            (pub_id, str(issue_id)),
                        )
                        cur.execute(
                            "UPDATE publications SET status = 3, "
                            "date_published = now() "
                            "WHERE publication_id = %s",
                            (pub_id,),
                        )
                    cur.execute(
                        "UPDATE submissions SET status = 3 WHERE submission_id = %s",
                        (sid,),
                    )
            conn.commit()
            return issue_id
    except Exception as exc:  # noqa: BLE001
        log.warning("OJS direct-DB issue write failed: %s", exc)
        return None


def _db_create_review_assignment(  # noqa: PLR0911 — distinct failure modes
    submission_id: int,
    reviewer_type: str,
    reviewer_id_str: str,
    recommendation: str,
    comments: str,
) -> Optional[int]:
    """Create a ``review_assignment`` (+ ``review_round`` if needed) via SQL.

    OJS 3.4 returns 404 on ``POST /reviewAssignments``; the write path is
    only defined for direct DB access. We ensure exactly one review_round
    exists for the submission's external-review stage (stage_id=3,
    round=1), then insert a review_assignment that attributes to the OJS
    admin user. The real reviewer identity + recommendation + comments
    travel in ``competing_interests`` so editors see attribution in OJS.

    Returns the new ``review_id`` or None on any failure.
    """
    db_url = ojs_settings().db_url
    if not db_url:
        return None
    psycopg = _psycopg_or_none()
    if psycopg is None:
        return None
    admin_uid = _lookup_admin_user_id()
    if admin_uid is None:
        return None
    attribution_parts = [
        f"sof.ai reviewer: {reviewer_type}:{reviewer_id_str}",
        f"recommendation: {recommendation}",
    ]
    if comments:
        attribution_parts.append(f"comments:\n{comments}")
    attribution = "\n".join(attribution_parts)
    try:
        with psycopg.connect(db_url, connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT review_round_id FROM review_rounds "
                    "WHERE submission_id = %s AND stage_id = 3 AND round = 1",
                    (submission_id,),
                )
                row = cur.fetchone()
                if row is None:
                    cur.execute(
                        "INSERT INTO review_rounds "
                        "(submission_id, stage_id, round, status) "
                        "VALUES (%s, 3, 1, 1) RETURNING review_round_id",
                        (submission_id,),
                    )
                    row = cur.fetchone()
                if row is None:
                    conn.rollback()
                    return None
                round_id = int(row[0])
                # step=4 marks the review as complete so editors see it in
                # the "Reviews received" list rather than "Awaiting
                # response". review_method=1 is double-anonymous (the OJS
                # default) — we keep that since the competing_interests
                # field already carries open attribution.
                cur.execute(
                    """
                    INSERT INTO review_assignments (
                        submission_id, reviewer_id, review_round_id,
                        stage_id, review_method, round, step,
                        date_assigned, last_modified, date_completed,
                        competing_interests,
                        declined, cancelled, reminder_was_automatic,
                        request_resent
                    ) VALUES (
                        %s, %s, %s,
                        3, 1, 1, 4,
                        now(), now(), now(),
                        %s,
                        0, 0, 0,
                        0
                    ) RETURNING review_id
                    """,
                    (submission_id, admin_uid, round_id, attribution),
                )
                row = cur.fetchone()
                if row is None:
                    conn.rollback()
                    return None
                review_id = int(row[0])
            conn.commit()
            return review_id
    except Exception as exc:  # noqa: BLE001
        log.warning("OJS direct-DB review write failed: %s", exc)
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
    """Mirror a sof.ai article to OJS in two phases: create + publish.

    OJS 3.4 submissions are two-phase: POST /submissions creates an
    empty row with one child publication, then PUT /publications/{pid}
    sets title/abstract. Each phase is independently retry-safe:

    * Phase 1 (create): runs only while ``ojs_submission_id`` is NULL.
      On failure we record the error and bail; resync picks the row up
      again because ``ojs_synced_at`` is still NULL.
    * Phase 2 (publish): runs whenever the row has a submission id but
      is not yet fully synced. The publication id is persisted alongside
      the submission id on Phase 1 success so Phase 2 can resume without
      hitting OJS again to re-fetch it. On Phase-2 failure we keep both
      ids and re-record the error; the next resync picks the row up via
      its publish-phase filter (``ojs_synced_at IS NULL OR
      ojs_sync_error IS NOT NULL``) and calls mirror_article again —
      which then skips Phase 1 because ``ojs_submission_id`` is set.

    A fully-mirrored row has ``ojs_submission_id IS NOT NULL`` **and**
    ``ojs_publication_id IS NOT NULL`` **and** ``ojs_synced_at IS NOT
    NULL`` **and** ``ojs_sync_error IS NULL``.
    """
    if not ojs_enabled():
        return False
    a = session.get(JournalArticle, article_id)
    if a is None:
        return False
    # Fully synced — idempotent no-op. The idempotency guard is
    # deliberately stricter than "submission id is set": a row that
    # landed Phase 1 but crashed on Phase 2 still needs mirror_article
    # to re-enter (skipping Phase 1) to finish the job.
    if (
        a.ojs_submission_id is not None
        and a.ojs_synced_at is not None
        and not a.ojs_sync_error
    ):
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

    # --- Phase 1: create the empty submission (only when not already done).
    # OJS 3.4 rejects any POST that tries to set title/abstract/
    # submissionProgress at creation time — those live on the child
    # publication, which is the next call. We also MUST pass sectionId +
    # locale; everything else is managed by the workflow.
    if a.ojs_submission_id is None:
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
            # resync_pending call would re-submit via the publish-phase
            # filter — silently creating a duplicate OJS submission.
            _record_error(
                a, session,
                OJSError("OJS create_submission did not return an id"),
            )
            return False

        # Pull the just-created publication id off the response. Every
        # fresh submission ships with exactly one publication. Persist
        # BOTH ids before attempting the publication PUT so a crash in
        # Phase 2 can resume cleanly from this row without re-entering
        # Phase 1 (which would leak a second OJS submission).
        pub_id: Optional[int] = None
        for pub in resp.get("publications") or []:
            if isinstance(pub, dict):
                pid = pub.get("id")
                if isinstance(pid, int):
                    pub_id = pid
                    break
        a.ojs_submission_id = raw_id
        a.ojs_publication_id = pub_id
        session.add(a)
        session.commit()

        if pub_id is None:
            _record_error(
                a, session,
                OJSError(
                    "OJS create_submission returned no publications[]. "
                    "Phase 2 cannot resume without a publication id; "
                    "manual intervention required (inspect OJS submissions "
                    f"#{raw_id} and populate ojs_publication_id by hand)."
                ),
            )
            return False

    # --- Phase 2: PUT title/abstract/coverage on the publication. --------
    # Re-read the persisted ids so we always use the stored values (the
    # row may have been reloaded between Phase 1 and Phase 2 on a retry).
    submission_id = a.ojs_submission_id
    publication_id = a.ojs_publication_id
    if submission_id is None or publication_id is None:
        # Defensive: can only happen if the row is mid-mutation in another
        # process. Record the error + bail; the publish-phase filter in
        # resync_pending will pick it up again.
        _record_error(
            a, session,
            OJSError("OJS submission/publication id missing before Phase 2"),
        )
        return False
    try:
        _client().update_publication(
            j.ojs_context_path,
            submission_id,
            publication_id,
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
    """Mirror a sof.ai peer review into OJS via direct Postgres INSERT.

    OJS 3.4's REST API returns 404 on ``POST /<context>/api/v1/
    reviewAssignments`` — the route isn't registered, so the write path
    is only defined for direct DB access. We delegate to
    ``_db_create_review_assignment`` which handles the ``review_rounds``
    upsert and the ``review_assignments`` insert in one transaction.

    When ``OJS_DB_URL`` isn't configured the mirror records a clear
    error on the row (no duplicate insert risk: without an id we never
    mark the row synced, so the next resync retries).
    """
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

    new_review_id = _db_create_review_assignment(
        submission_id=a.ojs_submission_id,
        reviewer_type=r.reviewer_type,
        reviewer_id_str=r.reviewer_id,
        recommendation=r.recommendation,
        comments=r.comments,
    )
    if new_review_id is None:
        _record_error(
            r,
            session,
            OJSError(
                "OJS direct-DB review insert failed — set OJS_DB_URL and "
                "confirm psycopg is installed so the adapter can reach the "
                "OJS Postgres cluster (OJS 3.4 has no REST write endpoint "
                "for reviewAssignments)."
            ),
        )
        return False
    r.ojs_review_assignment_id = new_review_id
    r.ojs_synced_at = _utcnow()
    r.ojs_sync_error = None
    session.add(r)
    session.commit()
    return True


def mirror_issue(session: Session, issue_id: int) -> bool:  # noqa: PLR0911
    """Mirror a sof.ai issue to OJS via a single Postgres transaction.

    OJS 3.4's REST API does not register ``POST /issues`` (the
    ``IssueHandler`` class exposes only GET routes) and has no separate
    ``/publish`` endpoint either, so the entire create+publish flow goes
    through Postgres in one transaction. See
    ``_db_create_and_publish_issue`` for the SQL.

    Idempotency:

    * If ``ojs_issue_id`` is already set and ``ojs_sync_error`` is clear,
      this is a no-op.
    * If the DB write fails (rolled back atomically by psycopg), we
      record the error on the row and bail — ``resync_pending`` picks
      it up again via its ``ojs_issue_id IS NULL`` filter.

    A fully-mirrored row has ``ojs_issue_id IS NOT NULL`` **and**
    ``ojs_sync_error IS NULL`` **and** ``ojs_synced_at IS NOT NULL``.
    """
    if not ojs_enabled():
        return False
    i = session.get(JournalIssue, issue_id)
    if i is None:
        return False
    # Already fully synced — idempotent no-op. Using ``is not None``
    # rather than truthiness so a hypothetical ``id: 0`` from OJS doesn't
    # slip through (the docstring's "IS NOT NULL" invariant is canonical).
    if (
        i.ojs_issue_id is not None
        and i.ojs_synced_at is not None
        and not i.ojs_sync_error
    ):
        return False

    j = session.exec(
        select(Journal).where(Journal.slug == i.journal_slug)
    ).first()
    if j is None or not j.ojs_context_path or j.ojs_context_id is None:
        return False

    # Collect every already-mirrored article that sof.ai has assigned to
    # this issue so the DB helper can attach them in the same
    # transaction. Articles still pending mirror (ojs_submission_id IS
    # NULL) are skipped here; once mirror_article lands them, a later
    # mirror_issue retry will re-attach them (issue id is already set,
    # so the DB helper's ``ON CONFLICT`` upsert keeps it idempotent).
    article_rows = session.exec(
        select(JournalArticle).where(
            JournalArticle.journal_slug == i.journal_slug,
            JournalArticle.published_issue_id == i.id,
            JournalArticle.ojs_submission_id.is_not(None),  # type: ignore[union-attr]
        )
    ).all()
    submission_ids = [
        a.ojs_submission_id  # type: ignore[misc]
        for a in article_rows
        if a.ojs_submission_id is not None
    ]

    new_issue_id = _db_create_and_publish_issue(
        context_id=j.ojs_context_id,
        volume=i.volume,
        number=str(i.number),
        title=i.title or f"Volume {i.volume}, Issue {i.number}",
        description=i.description,
        submission_ids=submission_ids,
    )
    if new_issue_id is None:
        _record_error(
            i,
            session,
            OJSError(
                "OJS direct-DB issue insert failed — set OJS_DB_URL and "
                "confirm psycopg is installed so the adapter can reach the "
                "OJS Postgres cluster (OJS 3.4 has no REST write endpoint "
                "for issues)."
            ),
        )
        return False

    i.ojs_issue_id = new_issue_id
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

    # Journals: pick up both never-mirrored rows AND rows that are
    # partially mirrored (context created but default section id not yet
    # cached — possible when the initial mirror_journal ran before
    # OJS_DB_URL was configured, or when the lookup transiently failed).
    j_rows = session.exec(
        select(Journal).where(
            (Journal.ojs_context_path.is_(None))  # type: ignore[union-attr]
            | (Journal.ojs_default_section_id.is_(None))  # type: ignore[union-attr]
            | (Journal.ojs_sync_error.is_not(None))  # type: ignore[union-attr]
        )
    ).all()
    for j in j_rows:
        if j.id and mirror_journal(session, j.id):
            journals += 1

    # Articles: pick up never-mirrored rows AND rows that completed Phase
    # 1 (submission id set) but failed Phase 2 (synced_at still NULL, or
    # a persisted sync_error). mirror_article handles the skip-Phase-1
    # branch using the stored ojs_submission_id + ojs_publication_id.
    a_rows = session.exec(
        select(JournalArticle).where(
            (JournalArticle.ojs_submission_id.is_(None))  # type: ignore[union-attr]
            | (JournalArticle.ojs_synced_at.is_(None))  # type: ignore[union-attr]
            | (JournalArticle.ojs_sync_error.is_not(None))  # type: ignore[union-attr]
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
