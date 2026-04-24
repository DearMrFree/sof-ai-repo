"""Tests for the public (unauthenticated) challenge feedback endpoint."""

from fastapi.testclient import TestClient

from sof_ai_api.db import init_db
from sof_ai_api.main import app
from sof_ai_api.routes import challenges as challenges_routes

init_db()
client = TestClient(app)


def _reset_rate_limit() -> None:
    """Each test gets a clean rate-limit bucket.

    The bucket is module-level so tests that don't reset it would leak
    state into each other — especially flaky when run in random order.
    """
    challenges_routes._public_rate.clear()


def test_public_challenge_creates_row() -> None:
    _reset_rate_limit()
    resp = client.post(
        "/challenges/public",
        json={
            "email": "Brandon.Bayquen@Example.com",
            "name": "Brandon Bayquen",
            "body": "V1 home page feels like AI slop.",
            "tag": "idea",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["body"] == "V1 home page feels like AI slop."
    assert data["tag"] == "idea"
    assert data["status"] == "new"
    # user_id is always lowercased and prefixed.
    assert data["user_id"] == "external:brandon.bayquen@example.com"
    assert data["handle"] == "brandon-bayquen"


def test_public_challenge_honeypot_blocks() -> None:
    _reset_rate_limit()
    resp = client.post(
        "/challenges/public",
        json={
            "email": "bot@example.com",
            "body": "buy cheap ugg boots now",
            "tag": "idea",
            "website": "http://spam.example.com",
        },
    )
    assert resp.status_code == 400


def test_public_challenge_bad_email_rejected() -> None:
    _reset_rate_limit()
    resp = client.post(
        "/challenges/public",
        json={"email": "not-an-email", "body": "hello", "tag": "idea"},
    )
    # pydantic EmailStr returns 422.
    assert resp.status_code == 422


def test_public_challenge_body_cap_is_1000() -> None:
    _reset_rate_limit()
    resp = client.post(
        "/challenges/public",
        json={
            "email": "long@example.com",
            "body": "x" * 1001,
            "tag": "idea",
        },
    )
    assert resp.status_code == 422


def test_public_challenge_rate_limit() -> None:
    _reset_rate_limit()
    email = "ratelimit@example.com"
    for i in range(5):
        r = client.post(
            "/challenges/public",
            json={
                "email": email,
                "body": f"entry number {i + 1}",
                "tag": "idea",
            },
        )
        assert r.status_code == 200, r.text
    r6 = client.post(
        "/challenges/public",
        json={"email": email, "body": "one too many", "tag": "idea"},
    )
    assert r6.status_code == 429


def test_public_challenge_rejects_javascript_url() -> None:
    _reset_rate_limit()
    r = client.post(
        "/challenges/public",
        json={
            "email": "urlsafe@example.com",
            "body": "try this",
            "tag": "idea",
            "page_url": "javascript:alert(1)",
        },
    )
    assert r.status_code == 422
