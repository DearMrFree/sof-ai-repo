"""Tests for the invitation system."""

from fastapi.testclient import TestClient

from sof_ai_api.db import init_db
from sof_ai_api.main import app
from sof_ai_api.routes import invitations as invitations_routes

init_db()
client = TestClient(app)

PRINCIPAL = "email:freedom@thevrschool.org"


def _reset_rate_limit() -> None:
    invitations_routes._rate.clear()


def test_create_and_list_invitation() -> None:
    _reset_rate_limit()
    r = client.post(
        "/invitations",
        json={
            "inviter_id": PRINCIPAL,
            "email": "Friend@Example.com",
            "name": "Friend of sof.ai",
            "role": "contributor",
            "message": "Come build with us.",
        },
    )
    assert r.status_code == 200, r.text
    row = r.json()
    assert row["email"] == "friend@example.com"
    assert row["status"] == "pending"
    assert row["role"] == "contributor"
    token = row["token"]
    assert isinstance(token, str) and len(token) >= 16

    # Token lookup works.
    lookup = client.get(f"/invitations/accept/{token}")
    assert lookup.status_code == 200
    assert lookup.json()["email"] == "friend@example.com"

    # List by inviter.
    listed = client.get("/invitations", params={"inviter_id": PRINCIPAL})
    assert listed.status_code == 200
    assert any(i["email"] == "friend@example.com" for i in listed.json())


def test_non_principal_cannot_invite() -> None:
    _reset_rate_limit()
    r = client.post(
        "/invitations",
        json={
            "inviter_id": "guest:random-guest",
            "email": "abc@example.com",
            "role": "contributor",
        },
    )
    assert r.status_code == 403


def test_bad_role_rejected() -> None:
    _reset_rate_limit()
    r = client.post(
        "/invitations",
        json={
            "inviter_id": PRINCIPAL,
            "email": "x@example.com",
            "role": "overlord",
        },
    )
    assert r.status_code == 400


def test_accept_flow() -> None:
    _reset_rate_limit()
    r = client.post(
        "/invitations",
        json={
            "inviter_id": PRINCIPAL,
            "email": "accept@example.com",
            "role": "reviewer",
        },
    )
    assert r.status_code == 200
    token = r.json()["token"]

    accepted = client.post(
        f"/invitations/accept/{token}",
        json={"accepted_user_id": "email:accept@example.com"},
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"

    # Second accept is a no-op (idempotent).
    again = client.post(
        f"/invitations/accept/{token}",
        json={"accepted_user_id": "email:accept@example.com"},
    )
    assert again.status_code == 200


def test_revoke_invitation() -> None:
    _reset_rate_limit()
    r = client.post(
        "/invitations",
        json={
            "inviter_id": PRINCIPAL,
            "email": "revoke@example.com",
            "role": "contributor",
        },
    )
    invitation_id = r.json()["id"]

    revoked = client.patch(
        f"/invitations/{invitation_id}",
        json={"status": "revoked"},
    )
    assert revoked.status_code == 200
    assert revoked.json()["status"] == "revoked"

    # Cannot accept a revoked invite.
    token = r.json()["token"]
    accept = client.post(
        f"/invitations/accept/{token}",
        json={"accepted_user_id": "someone"},
    )
    assert accept.status_code == 410


def test_duplicate_pending_invite_returns_existing() -> None:
    _reset_rate_limit()
    r1 = client.post(
        "/invitations",
        json={
            "inviter_id": PRINCIPAL,
            "email": "dupe@example.com",
            "role": "contributor",
        },
    )
    r2 = client.post(
        "/invitations",
        json={
            "inviter_id": PRINCIPAL,
            "email": "dupe@example.com",
            "role": "contributor",
        },
    )
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["id"] == r2.json()["id"]
