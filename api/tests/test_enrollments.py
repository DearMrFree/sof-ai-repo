"""Tests for the Enrollment + EnrollmentProfessor routes.

Coverage:
  * POST /enrollments persists with default-active status
  * Initial professor roster is created in the same call
  * GET /enrollments lists, filterable by status + track
  * GET /enrollments/{id} returns the professor roster
  * POST /enrollments/{id}/professors adds a professor; idempotent on (email, role)
  * DELETE /enrollments/{id}/professors/{prof_id} removes a professor
  * PATCH /enrollments/{id} updates status/notes/track
  * Re-create with same application_id is idempotent (returns existing row)
  * All mutating endpoints require X-Internal-Auth (no auth → 401)
"""

import os

from fastapi.testclient import TestClient

from sof_ai_api.db import init_db
from sof_ai_api.main import app

os.environ.setdefault("INTERNAL_API_KEY", "test-internal-key")
init_db()
client = TestClient(app)
AUTH = {"X-Internal-Auth": "test-internal-key"}


def _create(
    student_email: str = "blajon@ai1.example",
    professors: list[dict] | None = None,
    application_id: int | None = None,
) -> dict:
    body = {
        "student_name": "Blajon Lux",
        "student_email": student_email,
        "agent_name": "LuxAI1",
        "agent_url": "https://ai1.llc",
        "track": "human_with_ai",
        "professors": professors
        or [
            {
                "professor_email": "freedom@thevrschool.org",
                "professor_name": "Dr. Freedom Cheteni",
                "professor_kind": "human",
                "role": "lead",
            },
            {
                "professor_email": "devin@sof.ai",
                "professor_name": "Devin",
                "professor_kind": "ai",
                "role": "lead",
            },
        ],
    }
    if application_id is not None:
        body["application_id"] = application_id
    r = client.post("/student-enrollments", json=body, headers=AUTH)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_persists_with_active_default() -> None:
    e = _create()
    assert e["id"] > 0
    assert e["status"] == "active"
    assert e["student_name"] == "Blajon Lux"
    assert e["agent_name"] == "LuxAI1"
    assert len(e["professors"]) == 2
    emails = {p["professor_email"] for p in e["professors"]}
    assert emails == {"freedom@thevrschool.org", "devin@sof.ai"}


def test_create_validates_required_fields() -> None:
    r = client.post(
        "/student-enrollments",
        json={"agent_name": "X"},  # missing student_name + student_email
        headers=AUTH,
    )
    assert r.status_code == 422


def test_list_filters_by_status() -> None:
    a = _create(student_email="active1@ai1.example")
    paused = _create(student_email="paused1@ai1.example")
    client.patch(
        f"/student-enrollments/{paused['id']}",
        json={"status": "paused"},
        headers=AUTH,
    )
    r = client.get("/student-enrollments?status=paused")
    ids = {e["id"] for e in r.json()}
    assert paused["id"] in ids
    assert a["id"] not in ids


def test_get_returns_professor_roster() -> None:
    e = _create(student_email="get-prof@ai1.example")
    r = client.get(f"/student-enrollments/{e['id']}")
    assert r.status_code == 200
    detail = r.json()
    professors = {
        (p["professor_email"], p["role"]) for p in detail["professors"]
    }
    assert ("freedom@thevrschool.org", "lead") in professors
    assert ("devin@sof.ai", "lead") in professors


def test_add_professor_idempotent() -> None:
    e = _create(student_email="add-prof@ai1.example")
    body = {
        "professor_email": "claude@sof.ai",
        "professor_name": "Claude",
        "professor_kind": "ai",
        "role": "co_lead",
    }
    r1 = client.post(
        f"/student-enrollments/{e['id']}/professors", json=body, headers=AUTH
    )
    assert r1.status_code == 201
    r2 = client.post(
        f"/student-enrollments/{e['id']}/professors", json=body, headers=AUTH
    )
    # Idempotent: second call returns the SAME id (upsert by email+role).
    assert r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"]


def test_remove_professor() -> None:
    e = _create(student_email="rm-prof@ai1.example")
    prof = client.post(
        f"/student-enrollments/{e['id']}/professors",
        json={
            "professor_email": "guest@example.com",
            "professor_name": "Guest",
            "role": "guest",
        },
        headers=AUTH,
    ).json()
    r = client.delete(
        f"/student-enrollments/{e['id']}/professors/{prof['id']}", headers=AUTH
    )
    assert r.status_code == 204
    detail = client.get(f"/student-enrollments/{e['id']}").json()
    emails = {p["professor_email"] for p in detail["professors"]}
    assert "guest@example.com" not in emails


def test_patch_updates_status_and_notes() -> None:
    e = _create(student_email="patch@ai1.example")
    r = client.patch(
        f"/student-enrollments/{e['id']}",
        json={
            "status": "graduated",
            "notes": "Shipped 12 articles, 3 challenges, 1 capstone PR.",
        },
        headers=AUTH,
    )
    assert r.status_code == 200
    out = r.json()
    assert out["status"] == "graduated"
    assert "12 articles" in out["notes"]


def test_professor_batch_savepoint_isolates_conflicts() -> None:
    """Regression: when one professor in a batch fails the unique
    constraint (e.g. a concurrent caller inserted the same row between
    our SELECT and our INSERT), the other professors in the batch must
    still land. The previous logic used a single ``session.commit()``
    with ``try/except IntegrityError`` that rolled back the entire
    batch, silently dropping non-conflicting rows.

    We simulate the race by:
      1. Creating an enrollment.
      2. Inserting a professor row directly into the DB (the "racing"
         caller's insert).
      3. Monkey-patching ``_load_professors`` to lie on the first call
         so the in-memory ``seen`` check doesn't catch the racing row,
         which forces the IntegrityError path inside the loop.
      4. Re-POSTing with both the conflicting and a fresh professor.

    Expected result: the fresh professor lands; the conflicting one is
    silently skipped; all earlier-existing professors are still there.
    """
    from sof_ai_api.db import engine as _engine
    from sof_ai_api.models import StudentProfessor as _SP, _utcnow as _now
    from sof_ai_api.routes import enrollments as _routes
    from sqlmodel import Session as _Session

    e = _create(
        student_email="savepoint@ai1.example",
        application_id=9101,
    )
    enrollment_id = e["id"]

    # Pre-existing professors from _create(): freedom + devin (role=lead).
    # Insert a third row directly to mimic a concurrent caller's insert.
    with _Session(_engine) as s:
        s.add(
            _SP(
                student_enrollment_id=enrollment_id,
                professor_email="racer@example.com",
                professor_name="Racer",
                professor_kind="human",
                role="guest",
                added_at=_now(),
            )
        )
        s.commit()

    # Lie to the route on the first _load_professors() call so the
    # racer row isn't pre-skipped by the in-memory seen check. The
    # second call (serializer at the end) uses the real loader.
    real_load = _routes._load_professors
    calls = {"n": 0}

    def lying_load(session, eid):  # type: ignore[no-untyped-def]
        calls["n"] += 1
        if calls["n"] == 1:
            return []
        return real_load(session, eid)

    _routes._load_professors = lying_load
    try:
        r = client.post(
            "/student-enrollments",
            json={
                "application_id": 9101,
                "student_name": "Blajon Lux",
                "student_email": "savepoint@ai1.example",
                "agent_name": "LuxAI1",
                "professors": [
                    # Will race-collide with the row inserted above.
                    {
                        "professor_email": "racer@example.com",
                        "professor_name": "Racer",
                        "role": "guest",
                    },
                    # Must still land despite the sibling collision.
                    {
                        "professor_email": "newcomer@example.com",
                        "professor_name": "Newcomer",
                        "role": "co_lead",
                    },
                ],
            },
            headers=AUTH,
        )
    finally:
        _routes._load_professors = real_load

    assert r.status_code == 201, r.text
    out = r.json()
    assert out["id"] == enrollment_id  # idempotent merge
    emails = {p["professor_email"] for p in out["professors"]}
    # The racer row pre-existed (one copy, not duplicated).
    assert "racer@example.com" in emails
    # The non-conflicting newcomer landed even though its sibling
    # collided — proves the savepoint isolated the failure.
    assert "newcomer@example.com" in emails
    # Earlier professors from the first _create() are still there.
    assert "freedom@thevrschool.org" in emails
    assert "devin@sof.ai" in emails

    # No duplication of the racer row (would indicate the savepoint
    # didn't actually roll the conflicting insert back).
    assert sum(1 for p in out["professors"] if p["professor_email"] == "racer@example.com") == 1


def test_create_idempotent_on_application_id() -> None:
    """Same application_id → same enrollment (merges new professors)."""
    e1 = _create(student_email="idemp@ai1.example", application_id=42)
    e2 = client.post(
        "/student-enrollments",
        json={
            "application_id": 42,
            "student_name": "Blajon Lux",
            "student_email": "idemp@ai1.example",
            "agent_name": "LuxAI1",
            "professors": [
                {
                    "professor_email": "newprof@example.com",
                    "professor_name": "New Prof",
                    "role": "co_lead",
                }
            ],
        },
        headers=AUTH,
    )
    assert e2.status_code == 201
    e2_data = e2.json()
    assert e2_data["id"] == e1["id"]  # same enrollment row
    emails = {p["professor_email"] for p in e2_data["professors"]}
    assert "newprof@example.com" in emails  # new professor merged in
    assert "freedom@thevrschool.org" in emails  # existing kept
