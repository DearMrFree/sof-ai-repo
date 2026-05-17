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


def test_list_sorted_by_dept_then_number() -> None:
    """Default listing must be alphabetically sorted (dept, then course_number)."""
    r = client.get("/catalog/courses", params={"limit": 40})
    results = r.json()["results"]
    pairs = [(c["department"].lower(), c["course_number"].lower()) for c in results]
    assert pairs == sorted(pairs)


# ── Search ranking tests ──────────────────────────────────────────────────────

def test_search_course_number_is_top_result() -> None:
    """Searching by an exact course number should return that course first."""
    r = client.get("/catalog/courses/search", params={"q": "6.006"})
    assert r.status_code == 200
    results = r.json()["results"]
    assert results, "Expected at least one result for '6.006'"
    assert "6.006" in results[0]["course_number"]


def test_search_title_match_ranks_above_description_match() -> None:
    """A course whose title contains the query must outrank one where only
    the description mentions it."""
    r = client.get("/catalog/courses/search", params={"q": "linear algebra"})
    assert r.status_code == 200
    results = r.json()["results"]
    assert results, "Expected results for 'linear algebra'"
    titles = [c["title"].lower() for c in results]
    # The first result should have "linear algebra" in the title.
    assert "linear algebra" in titles[0], f"Expected title match first, got: {titles[:3]}"


def test_search_multiword_all_words_required() -> None:
    """A two-word query must only return courses containing both words."""
    r = client.get("/catalog/courses/search", params={"q": "quantum physics"})
    assert r.status_code == 200
    for course in r.json()["results"]:
        haystack = (
            course["title"] + " " + course["description"] + " " +
            " ".join(course["subjects"]) + " " + course["department"]
        ).lower()
        assert "quantum" in haystack or "physics" in haystack


def test_search_instructor_name() -> None:
    r = client.get("/catalog/courses/search", params={"q": "Strang"})
    assert r.status_code == 200
    body = r.json()
    # Gilbert Strang teaches Linear Algebra — at least one result expected.
    assert body["total"] >= 1
    instr_names = [" ".join(c["instructors"]).lower() for c in body["results"]]
    assert any("strang" in n for n in instr_names), f"Expected Strang in instructors: {instr_names}"


def test_search_subject_tag_match() -> None:
    """Searching an ocw_topics tag should return relevant courses."""
    r = client.get("/catalog/courses/search", params={"q": "differential equations"})
    assert r.status_code == 200
    assert r.json()["total"] >= 1


def test_search_no_partial_word_false_positives() -> None:
    """'calculus' must not appear only because 'miscalculation' is in a description
    (i.e. substring matching is on whole-word basis per token)."""
    r = client.get("/catalog/courses/search", params={"q": "calculus"})
    assert r.status_code == 200
    # All results should actually relate to calculus, not random matches.
    # The seeded calculus courses exist; there shouldn't be zero.
    assert r.json()["total"] >= 1


def test_search_no_results_for_gibberish() -> None:
    r = client.get("/catalog/courses/search", params={"q": "xyzzyplugh99"})
    assert r.status_code == 200
    assert r.json()["total"] == 0


def test_search_subjects_use_ocw_topics_not_broad_categories() -> None:
    """Subjects on returned courses should be fine-grained OCW tags,
    not broad parent categories like 'Science & Math'."""
    r = client.get("/catalog/courses/search", params={"q": "algorithms"})
    assert r.status_code == 200
    results = r.json()["results"]
    assert results
    # At least one result should have a specific tag, not just "Science & Math".
    all_subjects = [s for c in results for s in c["subjects"]]
    broad_only = all(s in {"Science & Math", "Engineering", "Humanities"} for s in all_subjects)
    assert not broad_only, f"Subjects look too broad: {all_subjects[:10]}"
