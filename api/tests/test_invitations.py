"""Tests for the invitation system."""

import datetime as _dt

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from sof_ai_api.db import engine, init_db
from sof_ai_api.main import app
from sof_ai_api.models import Invitation
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


def test_status_pending_filter_excludes_lazy_expired() -> None:
    """Regression: ?status=pending must not leak rows that lazy-expired.

    Before the fix, list_invitations ran the ``WHERE status='pending'``
    query, then walked the returned rows and flipped any past-due ones to
    ``expired`` in place — but kept them in the response. Callers asked
    for pending and got back expired, which broke the ``/classroom/invite``
    page and any other UI that trusted the filter.
    """
    _reset_rate_limit()
    # Create one valid pending invite.
    r = client.post(
        "/invitations",
        json={
            "inviter_id": PRINCIPAL,
            "email": "pending-live@example.com",
            "role": "contributor",
        },
    )
    assert r.status_code == 200

    # Mint a second one and then rewind its expires_at directly in the DB
    # so the lazy-expiry branch fires on the next list call.
    r2 = client.post(
        "/invitations",
        json={
            "inviter_id": PRINCIPAL,
            "email": "pending-stale@example.com",
            "role": "contributor",
        },
    )
    assert r2.status_code == 200
    stale_id = r2.json()["id"]
    with Session(engine) as session:
        row = session.exec(
            select(Invitation).where(Invitation.id == stale_id)
        ).one()
        row.expires_at = _dt.datetime.now(_dt.UTC) - _dt.timedelta(days=1)
        session.add(row)
        session.commit()

    pending = client.get(
        "/invitations", params={"inviter_id": PRINCIPAL, "status": "pending"}
    )
    assert pending.status_code == 200
    pending_ids = {i["id"] for i in pending.json()}
    assert stale_id not in pending_ids, (
        "Stale row lazy-expired but still leaked into status=pending"
    )

    # And ?status=expired picks it up.
    expired = client.get(
        "/invitations", params={"inviter_id": PRINCIPAL, "status": "expired"}
    )
    assert expired.status_code == 200
    assert stale_id in {i["id"] for i in expired.json()}


def test_duplicate_pending_does_not_consume_rate_slot() -> None:
    """Regression: idempotent dupe lookups must not eat the 24h budget.

    Before the fix, _rate_ok was called up front and recorded a hit even
    when the request resolved to 'return the existing pending invite'.
    A page refresh or double-click would therefore burn slots for nothing.
    """
    _reset_rate_limit()
    first = client.post(
        "/invitations",
        json={
            "inviter_id": PRINCIPAL,
            "email": "rate-dupe@example.com",
            "role": "contributor",
        },
    )
    assert first.status_code == 200
    # Replay the same create many more times than the 10/day limit allows.
    for _ in range(15):
        again = client.post(
            "/invitations",
            json={
                "inviter_id": PRINCIPAL,
                "email": "rate-dupe@example.com",
                "role": "contributor",
            },
        )
        assert again.status_code == 200
        assert again.json()["id"] == first.json()["id"]
    # Brand-new invite still fits under the 10/day ceiling.
    fresh = client.post(
        "/invitations",
        json={
            "inviter_id": PRINCIPAL,
            "email": "rate-dupe-fresh@example.com",
            "role": "contributor",
        },
    )
    assert fresh.status_code == 200, fresh.text


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
