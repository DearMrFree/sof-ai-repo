"""Tests for the /catalog/sync endpoint."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from sof_ai_api.db import engine, init_db
from sof_ai_api.main import app
from sof_ai_api.seed_mit_ocw import seed as seed_mit_ocw

init_db()
with Session(engine) as _s:
    seed_mit_ocw(_s)

client = TestClient(app)


def test_sync_status_returns_count():
    r = client.get("/catalog/sync/status")
    assert r.status_code == 200
    body = r.json()
    assert "total_courses_in_db" in body
    assert body["total_courses_in_db"] >= 30
    assert "running" in body
    assert body["running"] is False


def test_sync_requires_auth_when_key_set(monkeypatch):
    # Temporarily set an internal_api_key.
    from sof_ai_api import routes
    monkeypatch.setattr(routes.catalog.settings, "internal_api_key", "secret123")
    r = client.post("/catalog/sync?limit=1")
    assert r.status_code == 403


def test_sync_starts_with_correct_auth(monkeypatch):
    from unittest.mock import MagicMock, patch
    from sof_ai_api import routes

    monkeypatch.setattr(routes.catalog.settings, "internal_api_key", "secret123")
    monkeypatch.setattr(routes.catalog, "_sync_state", {
        "running": False, "last_started": None, "last_finished": None,
        "last_count": 0, "last_error": None,
    })

    # Prevent background thread from actually calling the API.
    with patch("sof_ai_api.routes.catalog._run_sync"):
        r = client.post(
            "/catalog/sync?limit=1",
            headers={"X-Internal-Auth": "secret123"},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["started"] is True


def test_sync_open_when_no_key_configured(monkeypatch):
    from unittest.mock import patch
    from sof_ai_api import routes

    monkeypatch.setattr(routes.catalog.settings, "internal_api_key", "")
    monkeypatch.setattr(routes.catalog, "_sync_state", {
        "running": False, "last_started": None, "last_finished": None,
        "last_count": 0, "last_error": None,
    })

    with patch("sof_ai_api.routes.catalog._run_sync"):
        r = client.post("/catalog/sync?limit=1")
    assert r.status_code == 200
    assert r.json()["started"] is True
