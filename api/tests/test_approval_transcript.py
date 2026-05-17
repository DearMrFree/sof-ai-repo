"""Tests for school approval flag and aspirational transcript endpoint."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from sof_ai_api.db import engine, init_db
from sof_ai_api.main import app
from sof_ai_api.seed_mit_ocw import seed as seed_mit_ocw

init_db()
with Session(engine) as _s:
    seed_mit_ocw(_s)

client = TestClient(app)


# ── School approval ───────────────────────────────────────────────────────────

def test_seeded_courses_have_school_approved_flag() -> None:
    """All seeded courses should be school_approved=True."""
    r = client.get("/catalog/courses", params={"limit": 40})
    assert r.status_code == 200
    results = r.json()["results"]
    assert results
    for c in results:
        assert "school_approved" in c, f"Missing school_approved on {c['course_number']}"
        assert c["school_approved"] is True, f"Expected school_approved for {c['course_number']}"


def test_approved_endpoint_returns_only_approved() -> None:
    r = client.get("/catalog/courses/approved")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 30
    for c in body["results"]:
        assert c["school_approved"] is True


def test_approved_endpoint_filter_by_department() -> None:
    r = client.get("/catalog/courses/approved", params={"department": "Mathematics"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 4
    for c in body["results"]:
        assert "mathematics" in c["department"].lower()
        assert c["school_approved"] is True


def test_approved_endpoint_filter_by_level() -> None:
    r = client.get("/catalog/courses/approved", params={"level": "Undergraduate"})
    assert r.status_code == 200
    for c in r.json()["results"]:
        assert c["level"] == "Undergraduate"
        assert c["school_approved"] is True


def test_search_results_include_school_approved() -> None:
    """Search results must carry the school_approved field."""
    r = client.get("/catalog/courses/search", params={"q": "algorithms"})
    assert r.status_code == 200
    results = r.json()["results"]
    assert results
    for c in results:
        assert "school_approved" in c


# ── Aspirational transcript ───────────────────────────────────────────────────

def test_transcript_empty_plan() -> None:
    """Transcript for a user with no plan items returns zero courses."""
    r = client.get("/planner/transcript", params={"user_id": "test-transcript-empty-user"})
    assert r.status_code == 200
    body = r.json()
    assert body["total_courses"] == 0
    assert body["approved_count"] == 0
    assert body["sections"] == []
    assert body["school_name"] == "The VR School"
    assert body["school_url"] == "https://thevrschool.org"


def test_transcript_with_plan_items() -> None:
    """Transcript reflects saved courses with approval status."""
    # Find two course ids
    listing = client.get("/catalog/courses/approved", params={"limit": 2})
    courses = listing.json()["results"]
    assert len(courses) >= 2

    uid = "test-transcript-user-42"
    # Save two courses
    for c in courses[:2]:
        client.post("/planner/items", json={"user_id": uid, "course_id": c["id"]})

    r = client.get("/planner/transcript", params={"user_id": uid})
    assert r.status_code == 200
    body = r.json()
    assert body["total_courses"] == 2
    assert body["approved_count"] == 2  # both are seeded (approved)
    assert len(body["sections"]) >= 1

    # All entries should be in the "interested" bucket by default
    entries = [e for s in body["sections"] for e in s["courses"]]
    assert len(entries) == 2
    for entry in entries:
        assert entry["school_approved"] is True
        assert entry["source"] == "MIT OpenCourseWare"
        assert entry["status"] == "interested"


def test_transcript_sections_order() -> None:
    """Transcript sections follow in_progress → planned → interested → completed."""
    from sof_ai_api.models import AcademicPlanItem

    uid = "test-transcript-order-99"
    # Get 3 approved courses
    courses = client.get("/catalog/courses/approved", params={"limit": 3}).json()["results"]
    ids = [c["id"] for c in courses[:3]]

    # Add them
    item_ids = []
    for cid in ids:
        r = client.post("/planner/items", json={"user_id": uid, "course_id": cid})
        item_ids.append(r.json()["id"])

    # Set different statuses
    client.patch(f"/planner/items/{item_ids[0]}", params={"user_id": uid}, json={"status": "in_progress"})
    client.patch(f"/planner/items/{item_ids[1]}", params={"user_id": uid}, json={"status": "completed"})
    # item_ids[2] stays as "interested"

    r = client.get("/planner/transcript", params={"user_id": uid})
    body = r.json()
    assert body["total_courses"] == 3

    statuses = [s["status"] for s in body["sections"]]
    _ORDER = ["in_progress", "planned", "interested", "completed"]
    ordered = [s for s in _ORDER if s in statuses]
    assert statuses == ordered


def test_transcript_requires_user_id() -> None:
    r = client.get("/planner/transcript")
    assert r.status_code == 422
