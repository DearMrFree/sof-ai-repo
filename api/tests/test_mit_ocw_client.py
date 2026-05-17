"""Tests for the MIT OCW ingestion client — no live API calls.

All tests use a canned API response fixture that mirrors the actual
MIT Learn /courses/ response shape observed on 2025-05-17.
"""

from unittest.mock import MagicMock, patch

import pytest
from sqlmodel import Session

from sof_ai_api.db import engine, init_db
from sof_ai_api.integrations.mit_ocw.client import _normalize, _primary_course_number, fetch_and_upsert
from sof_ai_api.models import MitOcwCourse

# ── Fixture data mirroring the real API shape ─────────────────────────────────

_SAMPLE_RAW = {
    "id": 3308,
    "readable_id": "11.165+fall_2011",
    "title": "Infrastructure and Energy Technology Challenges",
    "description": "This seminar examines efforts in developing and advanced nations.",
    "url": "https://ocw.mit.edu/courses/11-165-infrastructure-and-energy-technology-challenges-fall-2011/",
    "platform": {"code": "ocw", "name": "MIT OpenCourseWare"},
    "course_feature": ["Lecture Notes", "Written Assignments"],
    "departments": [{"department_id": "11", "name": "Urban Studies and Planning"}],
    "image": {
        "id": 2012,
        "url": "https://ocw.mit.edu/courses/11-165-infrastructure-and-energy-technology-challenges-fall-2011/thumb.jpg",
    },
    # ocw_topics is the fine-grained tag list we actually store (preferred).
    # topics is the broad parent-category tree (fallback only).
    "ocw_topics": ["Developmental Economics", "Economics", "Energy", "International Development", "Public Policy"],
    "topics": [
        {"id": 698, "name": "Data Science, Analytics & Computer Technology", "parent": None},
        {"id": 712, "name": "Social Sciences", "parent": None},
        {"id": 715, "name": "Economics", "parent": 712},
    ],
    "runs": [
        {
            "id": 1948,
            "semester": "Fall",
            "year": 2011,
            "url": "https://ocw.mit.edu/courses/11-165-infrastructure-and-energy-technology-challenges-fall-2011/",
            "level": [{"code": "undergraduate", "name": "Undergraduate"}],
            "instructors": [
                {"id": 573, "full_name": "Prof. Karen R. Polenske"},
                {"id": 574, "full_name": "Prof. Apiwat Ratanawaraha"},
            ],
        }
    ],
    "course": {
        "course_numbers": [
            {"value": "11.165", "listing_type": "primary"},
            {"value": "11.477", "listing_type": "cross-listed"},
        ]
    },
}

_SAMPLE_VIDEO = {
    **_SAMPLE_RAW,
    "readable_id": "6.006+fall_2020",
    "title": "Introduction to Algorithms",
    "ocw_topics": ["Algorithms and Data Structures", "Computer Science", "Theory of Computation"],
    "course_feature": ["Lecture Videos", "Problem Sets"],
    "departments": [{"department_id": "6", "name": "Electrical Engineering and Computer Science"}],
    "runs": [
        {
            **_SAMPLE_RAW["runs"][0],
            "semester": "Fall",
            "year": 2020,
            "level": [{"code": "undergraduate", "name": "Undergraduate"}],
        }
    ],
    "course": {"course_numbers": [{"value": "6.006", "listing_type": "primary"}]},
}

_SAMPLE_GRAD = {
    **_SAMPLE_RAW,
    "readable_id": "6.858+fall_2014",
    "title": "Computer Systems Security",
    "ocw_topics": ["Computer Science", "Security Studies", "Theory of Computation"],
    "course_feature": ["Lecture Videos"],
    "departments": [{"department_id": "6", "name": "Electrical Engineering and Computer Science"}],
    "runs": [
        {
            **_SAMPLE_RAW["runs"][0],
            "year": 2014,
            "level": [{"code": "graduate", "name": "Graduate"}],
        }
    ],
    "course": {"course_numbers": [{"value": "6.858", "listing_type": "primary"}]},
}


# ── Unit tests for _normalize ─────────────────────────────────────────────────

def test_normalize_basic_fields():
    out = _normalize(_SAMPLE_RAW)
    assert out["ocw_id"] == "11.165+fall_2011"
    assert out["title"] == "Infrastructure and Energy Technology Challenges"
    assert out["url"] == "https://ocw.mit.edu/courses/11-165-infrastructure-and-energy-technology-challenges-fall-2011/"
    assert out["department"] == "Urban Studies and Planning"
    assert out["level"] == "Undergraduate"
    assert out["semester"] == "Fall"
    assert out["year"] == 2011


def test_normalize_course_number():
    out = _normalize(_SAMPLE_RAW)
    assert out["course_number"] == "11.165"


def test_normalize_instructors():
    import json
    out = _normalize(_SAMPLE_RAW)
    instructors = json.loads(out["instructors_json"])
    assert "Prof. Karen R. Polenske" in instructors
    assert "Prof. Apiwat Ratanawaraha" in instructors


def test_normalize_subjects_uses_ocw_topics():
    import json
    out = _normalize(_SAMPLE_RAW)
    subjects = json.loads(out["subjects_json"])
    # Must use fine-grained ocw_topics, not broad parent topics.
    assert "Economics" in subjects
    assert "Public Policy" in subjects
    # The broad parent label should NOT appear — it pollutes search relevance.
    assert "Social Sciences" not in subjects
    assert "Data Science, Analytics & Computer Technology" not in subjects


def test_normalize_subjects_fallback_to_topics_when_ocw_topics_missing():
    import json
    raw = {**_SAMPLE_RAW, "ocw_topics": None}
    out = _normalize(raw)
    subjects = json.loads(out["subjects_json"])
    # Falls back to the topics tree names.
    assert "Economics" in subjects


def test_normalize_thumbnail():
    out = _normalize(_SAMPLE_RAW)
    assert out["thumbnail_url"].endswith("thumb.jpg")


def test_normalize_has_video_false():
    out = _normalize(_SAMPLE_RAW)
    assert out["has_video"] is False


def test_normalize_has_assignments_true():
    out = _normalize(_SAMPLE_RAW)
    assert out["has_assignments"] is True


def test_normalize_video_course():
    out = _normalize(_SAMPLE_VIDEO)
    assert out["has_video"] is True
    assert out["has_assignments"] is True  # Problem Sets counts


def test_normalize_grad_level():
    out = _normalize(_SAMPLE_GRAD)
    assert out["level"] == "Graduate"


def test_normalize_url_already_absolute():
    out = _normalize(_SAMPLE_RAW)
    assert out["url"].startswith("https://ocw.mit.edu/")


def test_primary_course_number_primary_first():
    assert _primary_course_number(_SAMPLE_RAW) == "11.165"


def test_primary_course_number_falls_back_to_first():
    raw = {**_SAMPLE_RAW, "course": {"course_numbers": [{"value": "X.999", "listing_type": "cross-listed"}]}}
    assert _primary_course_number(raw) == "X.999"


def test_primary_course_number_no_course():
    raw = {**_SAMPLE_RAW, "course": {}, "readable_id": "fallback+2020"}
    assert _primary_course_number(raw) == "fallback+2020"


# ── Integration test: fetch_and_upsert with mocked HTTP ──────────────────────

init_db()


def _mock_page(items, next_url=None):
    return {"count": len(items), "next": next_url, "previous": None, "results": items}


def test_fetch_and_upsert_creates_rows():
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.side_effect = [
        _mock_page([_SAMPLE_RAW, _SAMPLE_VIDEO, _SAMPLE_GRAD]),  # page 1
        _mock_page([]),  # page 2 (empty → stop)
    ]

    with patch("sof_ai_api.integrations.mit_ocw.client.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_client.get.return_value = mock_resp

        with Session(engine) as session:
            count = fetch_and_upsert(session, limit=10)

    assert count == 3


def test_fetch_and_upsert_idempotent():
    """Running the sync twice should not duplicate rows."""
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.side_effect = [
        _mock_page([_SAMPLE_RAW]),
        _mock_page([]),
        _mock_page([_SAMPLE_RAW]),
        _mock_page([]),
    ]

    with patch("sof_ai_api.integrations.mit_ocw.client.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_client.get.return_value = mock_resp

        with Session(engine) as session:
            fetch_and_upsert(session, limit=5)
            from sqlmodel import select as _select
            before = len(session.exec(_select(MitOcwCourse).where(MitOcwCourse.ocw_id == "11.165+fall_2011")).all())

        with patch("sof_ai_api.integrations.mit_ocw.client.httpx.Client") as mock_client_cls2:
            mock_client2 = MagicMock()
            mock_client_cls2.return_value.__enter__.return_value = mock_client2
            mock_client2.get.return_value = mock_resp
            with Session(engine) as session2:
                fetch_and_upsert(session2, limit=5)
                after = len(session2.exec(_select(MitOcwCourse).where(MitOcwCourse.ocw_id == "11.165+fall_2011")).all())

    assert before == 1
    assert after == 1


def test_fetch_and_upsert_respects_limit():
    items = [
        {**_SAMPLE_RAW, "readable_id": f"test-{i}+2020", "title": f"Course {i}",
         "course": {"course_numbers": [{"value": str(i), "listing_type": "primary"}]}}
        for i in range(10)
    ]
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = _mock_page(items, next_url="http://next")

    with patch("sof_ai_api.integrations.mit_ocw.client.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_client.get.return_value = mock_resp

        with Session(engine) as session:
            count = fetch_and_upsert(session, limit=3)

    assert count == 3
