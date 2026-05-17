from fastapi.testclient import TestClient
from sqlmodel import Session

from sof_ai_api.db import engine, init_db
from sof_ai_api.main import app
from sof_ai_api.seed_mit_ocw import seed as seed_mit_ocw

init_db()
with Session(engine) as _s:
    seed_mit_ocw(_s)

client = TestClient(app)

_USER = "planner-test-user-1"


def _first_course_id() -> int:
    r = client.get("/catalog/courses", params={"limit": 1})
    return r.json()["results"][0]["id"]


def test_add_and_list_plan_item() -> None:
    course_id = _first_course_id()
    add = client.post("/planner/items", json={"user_id": _USER, "course_id": course_id})
    assert add.status_code == 200
    body = add.json()
    assert body["user_id"] == _USER
    assert body["course_id"] == course_id
    assert body["status"] == "interested"

    listing = client.get("/planner/items", params={"user_id": _USER})
    assert listing.status_code == 200
    ids = [i["course_id"] for i in listing.json()]
    assert course_id in ids


def test_add_is_idempotent() -> None:
    course_id = _first_course_id()
    r1 = client.post("/planner/items", json={"user_id": _USER, "course_id": course_id})
    r2 = client.post("/planner/items", json={"user_id": _USER, "course_id": course_id})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["id"] == r2.json()["id"]


def test_update_status() -> None:
    course_id = _first_course_id()
    add = client.post("/planner/items", json={"user_id": _USER, "course_id": course_id})
    item_id = add.json()["id"]
    patch = client.patch(
        f"/planner/items/{item_id}",
        json={"status": "planned"},
        params={"user_id": _USER},
    )
    assert patch.status_code == 200
    assert patch.json()["status"] == "planned"


def test_update_notes() -> None:
    course_id = _first_course_id()
    add = client.post("/planner/items", json={"user_id": _USER, "course_id": course_id})
    item_id = add.json()["id"]
    patch = client.patch(
        f"/planner/items/{item_id}",
        json={"notes": "Aiming for Fall 2025"},
        params={"user_id": _USER},
    )
    assert patch.status_code == 200
    assert patch.json()["notes"] == "Aiming for Fall 2025"


def test_invalid_status_rejected() -> None:
    course_id = _first_course_id()
    add = client.post("/planner/items", json={"user_id": _USER, "course_id": course_id})
    item_id = add.json()["id"]
    r = client.patch(
        f"/planner/items/{item_id}",
        json={"status": "not_a_real_status"},
        params={"user_id": _USER},
    )
    assert r.status_code == 422


def test_delete_plan_item() -> None:
    course_id = _first_course_id()
    add = client.post("/planner/items", json={"user_id": "planner-delete-user", "course_id": course_id})
    item_id = add.json()["id"]
    delete = client.delete(f"/planner/items/{item_id}", params={"user_id": "planner-delete-user"})
    assert delete.status_code == 204
    listing = client.get("/planner/items", params={"user_id": "planner-delete-user"})
    assert all(i["id"] != item_id for i in listing.json())


def test_filter_by_status() -> None:
    course_id = _first_course_id()
    add = client.post("/planner/items", json={"user_id": "planner-filter-user", "course_id": course_id})
    item_id = add.json()["id"]
    client.patch(
        f"/planner/items/{item_id}",
        json={"status": "completed"},
        params={"user_id": "planner-filter-user"},
    )
    r = client.get("/planner/items", params={"user_id": "planner-filter-user", "status": "completed"})
    assert r.status_code == 200
    assert all(i["status"] == "completed" for i in r.json())


def test_wrong_user_cannot_update() -> None:
    course_id = _first_course_id()
    add = client.post("/planner/items", json={"user_id": "owner-user", "course_id": course_id})
    item_id = add.json()["id"]
    r = client.patch(
        f"/planner/items/{item_id}",
        json={"status": "completed"},
        params={"user_id": "other-user"},
    )
    assert r.status_code == 404


def test_add_nonexistent_course() -> None:
    r = client.post("/planner/items", json={"user_id": _USER, "course_id": 999999})
    assert r.status_code == 404
