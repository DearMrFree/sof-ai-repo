# DATABASE_URL is overridden to a per-run temp sqlite file in conftest.py so
# the settings/engine singletons initialize against the temp DB rather than
# the developer's ./sof_ai.db.
from fastapi.testclient import TestClient

from sof_ai_api.db import init_db
from sof_ai_api.main import app

init_db()
client = TestClient(app)


def test_enroll_and_complete_flow() -> None:
    enroll = client.post(
        "/progress/enroll",
        json={"user_id": "u1", "program_slug": "software-engineer"},
    )
    assert enroll.status_code == 200

    # Enrolling twice is idempotent.
    enroll2 = client.post(
        "/progress/enroll",
        json={"user_id": "u1", "program_slug": "software-engineer"},
    )
    assert enroll2.status_code == 200
    assert enroll.json()["id"] == enroll2.json()["id"]

    complete = client.post(
        "/progress/complete",
        json={
            "user_id": "u1",
            "program_slug": "software-engineer",
            "lesson_slug": "what-is-version-control",
        },
    )
    assert complete.status_code == 200

    summary = client.get("/progress/u1/software-engineer")
    assert summary.status_code == 200
    body = summary.json()
    assert body["user_id"] == "u1"
    assert "what-is-version-control" in body["completed_lesson_slugs"]
    assert body["enrolled_at"] is not None


def test_devin_attempt_recorded() -> None:
    r = client.post(
        "/devin/attempts",
        json={
            "user_id": "u2",
            "program_slug": "software-engineer",
            "lesson_slug": "review-a-devin-pr",
            "session_url": "https://app.devin.ai/sessions/xyz",
            "prompt": "Add a /health endpoint.",
            "is_stub": True,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["session_url"] == "https://app.devin.ai/sessions/xyz"
    assert body["is_stub"] is True
