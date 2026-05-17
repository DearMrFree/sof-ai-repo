from fastapi.testclient import TestClient
from sqlmodel import Session

from sof_ai_api.db import engine, init_db
from sof_ai_api.main import app
from sof_ai_api.seed_mit_ocw import seed as seed_mit_ocw

init_db()
with Session(engine) as _s:
    seed_mit_ocw(_s)

client = TestClient(app)


def test_list_courses_returns_seeded_data() -> None:
    r = client.get("/catalog/courses")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 30
    assert len(body["results"]) > 0
    first = body["results"][0]
    assert "title" in first
    assert "course_number" in first
    assert "url" in first
    assert isinstance(first["subjects"], list)
    assert isinstance(first["instructors"], list)


def test_search_courses_by_keyword() -> None:
    r = client.get("/catalog/courses/search", params={"q": "algorithms"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    titles = [c["title"].lower() for c in body["results"]]
    assert any("algorithm" in t for t in titles)


def test_search_courses_calculus() -> None:
    r = client.get("/catalog/courses/search", params={"q": "calculus"})
    assert r.status_code == 200
    assert r.json()["total"] >= 1


def test_filter_by_department() -> None:
    r = client.get("/catalog/courses", params={"department": "Mathematics"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 4
    for c in body["results"]:
        assert "mathematics" in c["department"].lower()


def test_filter_by_level() -> None:
    r = client.get("/catalog/courses", params={"level": "Graduate"})
    assert r.status_code == 200
    for c in r.json()["results"]:
        assert c["level"] == "Graduate"


def test_get_course_by_id() -> None:
    listing = client.get("/catalog/courses", params={"limit": 1})
    first_id = listing.json()["results"][0]["id"]
    r = client.get(f"/catalog/courses/{first_id}")
    assert r.status_code == 200
    assert r.json()["id"] == first_id


def test_get_course_not_found() -> None:
    r = client.get("/catalog/courses/999999")
    assert r.status_code == 404


def test_list_departments() -> None:
    r = client.get("/catalog/departments")
    assert r.status_code == 200
    depts = r.json()
    assert isinstance(depts, list)
    assert len(depts) >= 5
    assert "Mathematics" in depts


def test_list_levels() -> None:
    r = client.get("/catalog/levels")
    assert r.status_code == 200
    levels = r.json()
    assert "Undergraduate" in levels


def test_pagination() -> None:
    page1 = client.get("/catalog/courses", params={"limit": 5, "offset": 0})
    page2 = client.get("/catalog/courses", params={"limit": 5, "offset": 5})
    ids1 = {c["id"] for c in page1.json()["results"]}
    ids2 = {c["id"] for c in page2.json()["results"]}
    assert ids1.isdisjoint(ids2)
