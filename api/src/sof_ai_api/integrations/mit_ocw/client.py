"""MIT OpenCourseWare ingestion client — MIT Learn API v1.

Endpoint: GET https://api.learn.mit.edu/api/v1/courses/?platform=ocw
Pagination: limit=100, offset-based; max page size enforced at 100 by upstream.

All OCW content is CC BY-NC-SA 4.0. The ``url`` field on every row is the
canonical OCW page URL which carries the license notice.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from ...models import MitOcwCourse

logger = logging.getLogger(__name__)

_MIT_LEARN_BASE = "https://api.learn.mit.edu/api/v1"
_PAGE_SIZE = 100

_VIDEO_FEATURES = {"Lecture Videos", "Problem-solving Videos", "Other Video"}
_ASSIGNMENT_FEATURES = {
    "Written Assignments",
    "Problem Sets",
    "Exams",
    "Projects",
    "Projects with Examples",
    "Programming Assignments",
    "Activity Assignments",
    "Design Assignments",
    "Presentation Assignments",
}


def _primary_course_number(raw: dict[str, Any]) -> str:
    """Extract the primary course number (e.g. '6.006') from the course object."""
    course = raw.get("course") or {}
    numbers = course.get("course_numbers") or []
    for cn in numbers:
        if cn.get("listing_type") == "primary":
            return str(cn.get("value") or "")
    if numbers:
        return str(numbers[0].get("value") or "")
    return str(raw.get("readable_id") or "")


def _normalize(raw: dict[str, Any]) -> dict[str, Any]:
    """Map a MIT Learn /courses/ result to our MitOcwCourse field shape."""
    runs = raw.get("runs") or []
    best_run: dict[str, Any] = {}
    if runs:
        # Prefer the most recent run by year, fall back to first.
        best_run = max(runs, key=lambda r: r.get("year") or 0) or runs[0]

    # Instructors — deduplicate across all runs, use full_name.
    seen: set[str] = set()
    instructors: list[str] = []
    for run in runs:
        for inst in run.get("instructors") or []:
            name = str(inst.get("full_name") or "").strip()
            if name and name not in seen:
                seen.add(name)
                instructors.append(name)

    # Subjects — ocw_topics is a flat list of specific OCW subject labels
    # (e.g. ["Algorithms and Data Structures", "Computer Science"]).
    # Prefer it over the broad "topics" parent-category tree, which produces
    # too many false positives in search (e.g. every EECS course would match
    # "Data Science, Analytics & Computer Technology").
    raw_ocw_topics: list[str] = raw.get("ocw_topics") or []
    subjects: list[str] = [s.strip() for s in raw_ocw_topics if s and s.strip()]
    # Fall back to topics names only when ocw_topics is empty.
    if not subjects:
        subjects = [
            str(t.get("name") or "").strip()
            for t in (raw.get("topics") or [])
            if t.get("name")
        ]

    # Level — take name from first entry in best_run's level list.
    level_list = best_run.get("level") or []
    level = str(level_list[0].get("name") or "") if level_list else ""
    if not level:
        level = "Undergraduate"  # sensible default for OCW

    # Image thumbnail.
    img = raw.get("image") or {}
    thumbnail = str(img.get("url") or "") if isinstance(img, dict) else ""

    # course_feature drives has_video / has_assignments.
    features: set[str] = set(raw.get("course_feature") or [])

    # URL is already absolute in the API response.
    url = str(raw.get("url") or "")

    return {
        "ocw_id": str(raw.get("readable_id") or raw.get("id") or ""),
        "course_number": _primary_course_number(raw),
        "title": str(raw.get("title") or "").strip(),
        "description": str(raw.get("description") or "").strip(),
        "url": url,
        "thumbnail_url": thumbnail,
        "department": str((raw.get("departments") or [{}])[0].get("name") or ""),
        "level": level,
        "subjects_json": json.dumps(subjects[:20]),
        "instructors_json": json.dumps(instructors[:10]),
        "semester": str(best_run.get("semester") or ""),
        "year": int(best_run["year"]) if best_run.get("year") else None,
        "has_video": bool(features & _VIDEO_FEATURES),
        "has_assignments": bool(features & _ASSIGNMENT_FEATURES),
    }


def count_in_db(session: Session) -> int:
    return session.exec(select(func.count()).select_from(MitOcwCourse)).one()


def fetch_and_upsert(
    session: Session,
    limit: int = 500,
    department_id: str | None = None,
) -> int:
    """Fetch up to *limit* OCW courses from MIT Learn and upsert into the DB.

    Paginates through the API in batches of 100, committing each page to keep
    memory usage constant.  Returns the total number of rows created or updated.
    """
    params: dict[str, Any] = {
        "platform": "ocw",
        "limit": _PAGE_SIZE,
        "offset": 0,
    }
    if department_id:
        params["department"] = department_id

    upserted = 0
    with httpx.Client(timeout=30, follow_redirects=True) as http:
        while upserted < limit:
            resp = http.get(f"{_MIT_LEARN_BASE}/courses/", params=params)
            resp.raise_for_status()
            data = resp.json()
            results: list[dict[str, Any]] = data.get("results") or []
            if not results:
                break

            page_count = 0
            for raw in results:
                if upserted >= limit:
                    break
                fields = _normalize(raw)
                if not fields["ocw_id"] or not fields["title"]:
                    continue

                existing = session.exec(
                    select(MitOcwCourse).where(MitOcwCourse.ocw_id == fields["ocw_id"])
                ).first()
                if existing:
                    for k, v in fields.items():
                        setattr(existing, k, v)
                    existing.last_synced = datetime.now(UTC)
                    session.add(existing)
                else:
                    session.add(MitOcwCourse(**fields))
                upserted += 1
                page_count += 1

            try:
                session.commit()
            except IntegrityError:
                session.rollback()
                logger.warning("mit_ocw: IntegrityError on page offset=%d, skipping page", params["offset"])

            logger.info(
                "mit_ocw: synced page offset=%d rows=%d total_so_far=%d",
                params["offset"],
                page_count,
                upserted,
            )

            if not data.get("next") or page_count == 0:
                break
            params["offset"] += _PAGE_SIZE

    logger.info("mit_ocw.fetch_and_upsert complete total=%d", upserted)
    return upserted
