"""Tests for the magic-link authentication routes (PR-AUTH).

Coverage:
  * POST /auth/magic-link/request issues a token + persists only the hash
  * POST /auth/magic-link/verify consumes a valid token exactly once
  * Re-using the same token returns 409
  * An expired token returns 410
  * An unknown token returns 404
  * Per-email rate limit returns 429 after MAGIC_LINK_MAX_PER_HOUR active
  * Email is normalised on both request + verify
  * Internal-auth gate holds (no header → 401)
"""
from __future__ import annotations

import hashlib
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, delete, select

from sof_ai_api.db import engine, init_db
from sof_ai_api.main import app
from sof_ai_api.models import MagicLinkToken, _utcnow
from sof_ai_api.routes.auth import MAGIC_LINK_MAX_PER_HOUR
from sof_ai_api.settings import settings

init_db()
client = TestClient(app)
AUTH = {"X-Internal-Auth": "test-internal-key"}


@pytest.fixture(autouse=True)
def _gate_and_wipe() -> object:
    prior = settings.internal_api_key
    settings.internal_api_key = "test-internal-key"
    with Session(engine) as s:
        s.exec(delete(MagicLinkToken))
        s.commit()
    yield
    settings.internal_api_key = prior
    with Session(engine) as s:
        s.exec(delete(MagicLinkToken))
        s.commit()


def _request(email: str = "ada@example.com") -> dict:
    resp = client.post(
        "/auth/magic-link/request",
        json={"email": email},
        headers=AUTH,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_request_returns_token_and_persists_hash_only() -> None:
    out = _request("ada@example.com")
    assert "token" in out and len(out["token"]) >= 32
    assert out["email"] == "ada@example.com"
    assert "expires_at" in out

    # Database must contain the SHA-256 hash, not the raw token. Otherwise
    # a database leak yields directly usable magic links.
    with Session(engine) as s:
        rows = s.exec(select(MagicLinkToken)).all()
        assert len(rows) == 1
        digest = hashlib.sha256(out["token"].encode("utf-8")).hexdigest()
        assert rows[0].token_hash == digest
        assert rows[0].token_hash != out["token"]


def test_verify_happy_path_then_replay_is_409() -> None:
    out = _request("Ada@Example.com")  # mixed case → normalised
    token = out["token"]

    first = client.post(
        "/auth/magic-link/verify",
        json={"token": token},
        headers=AUTH,
    )
    assert first.status_code == 200
    assert first.json()["email"] == "ada@example.com"

    second = client.post(
        "/auth/magic-link/verify",
        json={"token": token},
        headers=AUTH,
    )
    assert second.status_code == 409


def test_verify_unknown_token_is_404() -> None:
    resp = client.post(
        "/auth/magic-link/verify",
        json={"token": "never-issued-deadbeef-x" * 2},
        headers=AUTH,
    )
    assert resp.status_code == 404


def test_verify_expired_token_is_410() -> None:
    out = _request("ada@example.com")
    token = out["token"]
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with Session(engine) as s:
        row = s.exec(
            select(MagicLinkToken).where(MagicLinkToken.token_hash == digest)
        ).first()
        assert row is not None
        row.expires_at = _utcnow() - timedelta(seconds=10)
        s.add(row)
        s.commit()

    resp = client.post(
        "/auth/magic-link/verify",
        json={"token": token},
        headers=AUTH,
    )
    assert resp.status_code == 410


def test_rate_limit_is_429_after_threshold() -> None:
    for _ in range(MAGIC_LINK_MAX_PER_HOUR):
        out = _request("ada@example.com")
        assert "token" in out

    over = client.post(
        "/auth/magic-link/request",
        json={"email": "ada@example.com"},
        headers=AUTH,
    )
    assert over.status_code == 429


def test_internal_auth_gate_holds() -> None:
    resp = client.post(
        "/auth/magic-link/request",
        json={"email": "ada@example.com"},
    )
    assert resp.status_code == 401

    resp = client.post(
        "/auth/magic-link/verify",
        json={"token": "anything"},
    )
    assert resp.status_code == 401


def test_invalid_email_is_400() -> None:
    resp = client.post(
        "/auth/magic-link/request",
        json={"email": "no-at-sign"},
        headers=AUTH,
    )
    assert resp.status_code == 400


def test_email_normalised_on_verify() -> None:
    out = _request("FRED@Example.COM")
    assert out["email"] == "fred@example.com"
    resp = client.post(
        "/auth/magic-link/verify",
        json={"token": out["token"]},
        headers=AUTH,
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "fred@example.com"
