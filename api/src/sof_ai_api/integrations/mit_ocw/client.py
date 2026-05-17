"""MIT OpenCourseWare / MIT Learn ingestion client.

Pulls courses from the MIT Learn public API (https://api.learn.mit.edu/api/v1)
and upserts them into the ``mitocwcourse`` table.  All OCW content is
CC BY-NC-SA 4.0; the canonical URL stored on each row carries the license
notice so every downstream artifact can link back.

The client degrades gracefully: if the upstream API is unreachable (network
policy, rate limit, etc.) the caller catches the exception and falls back to
the static seed data in ``seed_mit_ocw.py``.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ...models import MitOcwCourse

logger = logging.getLogger(__name__)

_MIT_LEARN_BASE = "https://api.learn.mit.edu/api/v1"
_PAGE_SIZE = 100


def _normalize(raw: dict[str, Any]) -> dict[str, Any]:
    """Map a MIT Learn API course object to our MitOcwCourse field shape."""
    runs = raw.get("runs") or []
    latest = runs[0] if runs else {}

    instructors: list[str] = []
    for run in runs:
        for inst in run.get("instructors") or []:
            name = inst.get("full_name") or inst.get("name") or ""
            if name and name not in instructors:
                instructors.append(name)

    subjects: list[str] = [
        t.get("name", "") for t in (raw.get("topics") or []) if t.get("name")
    ]

    level_raw = (raw.get("level") or [None])[0] or ""
    level_map = {"undergraduate": "Undergraduate", "graduate": "Graduate", "high_school": "High School", "non_credit": "Non-Credit"}
    level = level_map.get(str(level_raw).lower(), str(level_raw).title())

    img = raw.get("image") or {}
    thumbnail = img.get("url", "") if isinstance(img, dict) else ""

    return {
        "ocw_id": str(raw.get("readable_id") or raw.get("id") or ""),
        "course_number": str(raw.get("course_num") or raw.get("readable_id") or ""),
        "title": str(raw.get("title") or ""),
        "description": str(raw.get("description") or ""),
        "url": f"https://ocw.mit.edu{raw['url']}" if raw.get("url") else "",
        "thumbnail_url": thumbnail,
        "department": str((raw.get("departments") or [{}])[0].get("name", "")),
        "level": level,
        "subjects_json": json.dumps(subjects),
        "instructors_json": json.dumps(instructors),
        "semester": str(latest.get("semester") or ""),
        "year": int(latest["year"]) if latest.get("year") else None,
        "has_video": bool(raw.get("resource_type_name") == "Video" or raw.get("video_count")),
        "has_assignments": bool(raw.get("has_assignments")),
    }


def fetch_and_upsert(session: Session, limit: int = 500, department: str | None = None) -> int:
    """Fetch up to *limit* courses from MIT Learn and upsert into the DB.

    Returns the number of rows created or updated.
    """
    params: dict[str, Any] = {
        "resource_type": "course",
        "limit": min(limit, _PAGE_SIZE),
        "offset": 0,
        "platform": "ocw",
    }
    if department:
        params["department"] = department

    upserted = 0
    with httpx.Client(timeout=30) as client:
        while upserted < limit:
            resp = client.get(f"{_MIT_LEARN_BASE}/resources/", params=params)
            resp.raise_for_status()
            data = resp.json()
            results: list[dict[str, Any]] = data.get("results") or []
            if not results:
                break

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
                    session.add(existing)
                else:
                    session.add(MitOcwCourse(**fields))
                upserted += 1

            try:
                session.commit()
            except IntegrityError:
                session.rollback()

            if not data.get("next"):
                break
            params["offset"] += _PAGE_SIZE

    logger.info("mit_ocw.fetch_and_upsert completed rows=%d", upserted)
    return upserted
