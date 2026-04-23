from fastapi.testclient import TestClient

from sof_ai_api.db import init_db
from sof_ai_api.main import app

init_db()
client = TestClient(app)


def test_create_list_update_challenge() -> None:
    resp = client.post(
        "/challenges",
        json={
            "user_id": "u-feedback-1",
            "handle": "freedom",
            "body": "The re-roll button on /signin is easy to miss.",
            "tag": "confusing",
            "page_url": "https://sof.ai/signin",
        },
    )
    assert resp.status_code == 200, resp.text
    created = resp.json()
    assert created["body"] == "The re-roll button on /signin is easy to miss."
    assert created["tag"] == "confusing"
    assert created["status"] == "new"
    challenge_id = created["id"]

    listed = client.get("/challenges?status=new")
    assert listed.status_code == 200
    rows = listed.json()
    assert any(c["id"] == challenge_id for c in rows)

    patched = client.patch(
        f"/challenges/{challenge_id}",
        json={"status": "triaged"},
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "triaged"


def test_reject_bad_tag() -> None:
    r = client.post(
        "/challenges",
        json={
            "user_id": "u-feedback-2",
            "handle": "freedom",
            "body": "something",
            "tag": "nonsense",
        },
    )
    assert r.status_code == 400


def test_reject_javascript_page_url() -> None:
    # A javascript: URL must be rejected at the API boundary. Rendering it as
    # an anchor href elsewhere would let an authenticated attacker stage a
    # one-click XSS against whoever opens the triage board.
    r = client.post(
        "/challenges",
        json={
            "user_id": "u-feedback-xss",
            "handle": "freedom",
            "body": "crafted payload",
            "tag": "idea",
            "page_url": "javascript:alert(1)",
        },
    )
    assert r.status_code == 422, r.text


def test_accept_program_and_lesson_slug() -> None:
    r = client.post(
        "/challenges",
        json={
            "user_id": "u-feedback-nav",
            "handle": "freedom",
            "body": "lesson nav confusing",
            "tag": "confusing",
            "program_slug": "software-engineer",
            "lesson_slug": "reading-code",
            "page_url": "https://sof.ai/learn/software-engineer/reading-code",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["program_slug"] == "software-engineer"
    assert body["lesson_slug"] == "reading-code"


def test_reject_bad_status() -> None:
    create = client.post(
        "/challenges",
        json={
            "user_id": "u-feedback-3",
            "handle": "freedom",
            "body": "yet another",
            "tag": "idea",
        },
    )
    assert create.status_code == 200
    cid = create.json()["id"]

    r = client.patch(f"/challenges/{cid}", json={"status": "bogus"})
    assert r.status_code == 400
