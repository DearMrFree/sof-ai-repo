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
