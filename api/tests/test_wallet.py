"""Tests for the Educoin® ledger + /wallet routes."""

from fastapi.testclient import TestClient

from sof_ai_api.db import init_db
from sof_ai_api.main import app

init_db()
client = TestClient(app)


def test_wallet_created_on_first_read() -> None:
    r = client.get("/wallet/user/u-fresh")
    assert r.status_code == 200
    body = r.json()
    assert body["owner_type"] == "user"
    assert body["owner_id"] == "u-fresh"
    assert body["balance"] == 0
    assert body["lifetime_earned"] == 0


def test_lesson_complete_credits_wallet() -> None:
    # Enroll once — should trigger a +50 signup bonus.
    enroll = client.post(
        "/progress/enroll",
        json={"user_id": "u-earn", "program_slug": "software-engineer"},
    )
    assert enroll.status_code == 200

    w = client.get("/wallet/user/u-earn").json()
    assert w["balance"] >= 50, "signup bonus should land"
    assert w["lifetime_earned"] >= 50

    # Complete a lesson — +5 EDU.
    c1 = client.post(
        "/progress/complete",
        json={
            "user_id": "u-earn",
            "program_slug": "software-engineer",
            "lesson_slug": "lesson-a",
        },
    )
    assert c1.status_code == 200

    w2 = client.get("/wallet/user/u-earn").json()
    assert w2["balance"] == w["balance"] + 5

    # Re-submitting the same lesson-complete MUST be idempotent — no double-pay.
    c2 = client.post(
        "/progress/complete",
        json={
            "user_id": "u-earn",
            "program_slug": "software-engineer",
            "lesson_slug": "lesson-a",
        },
    )
    assert c2.status_code == 200
    w3 = client.get("/wallet/user/u-earn").json()
    assert w3["balance"] == w2["balance"], "earn dedupe on correlation_id"


def test_transfer_between_users() -> None:
    # Seed sender via enrollment + lesson completions.
    client.post(
        "/progress/enroll",
        json={"user_id": "u-sender", "program_slug": "software-engineer"},
    )
    for slug in ("a", "b", "c", "d"):
        client.post(
            "/progress/complete",
            json={
                "user_id": "u-sender",
                "program_slug": "software-engineer",
                "lesson_slug": slug,
            },
        )
    sender_before = client.get("/wallet/user/u-sender").json()["balance"]
    assert sender_before >= 70  # 50 signup + 4*5 lessons

    r = client.post(
        "/wallet/transfer",
        json={
            "sender_type": "user",
            "sender_id": "u-sender",
            "recipient_type": "user",
            "recipient_id": "u-recipient",
            "amount": 30,
            "memo": "thanks for the help",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["sender_balance"] == sender_before - 30
    assert body["recipient_balance"] == 30

    # Transactions endpoint shows both legs with matching correlation_id.
    tx_s = client.get("/wallet/user/u-sender/transactions").json()
    tx_r = client.get("/wallet/user/u-recipient/transactions").json()
    out_tx = next(t for t in tx_s if t["kind"] == "transfer_out")
    in_tx = next(t for t in tx_r if t["kind"] == "transfer_in")
    assert out_tx["correlation_id"] == in_tx["correlation_id"]
    assert out_tx["amount"] == -30
    assert in_tx["amount"] == 30
    assert out_tx["counterparty_id"] == "u-recipient"
    assert in_tx["counterparty_id"] == "u-sender"


def test_transfer_refuses_overdraw() -> None:
    r = client.post(
        "/wallet/transfer",
        json={
            "sender_type": "user",
            "sender_id": "u-broke",
            "recipient_type": "user",
            "recipient_id": "u-recipient",
            "amount": 1_000,
        },
    )
    assert r.status_code == 402


def test_transfer_refuses_self() -> None:
    r = client.post(
        "/wallet/transfer",
        json={
            "sender_type": "user",
            "sender_id": "u-self",
            "recipient_type": "user",
            "recipient_id": "u-self",
            "amount": 1,
        },
    )
    assert r.status_code == 400


def test_transfer_refuses_zero_or_negative() -> None:
    r0 = client.post(
        "/wallet/transfer",
        json={
            "sender_type": "user",
            "sender_id": "u-a",
            "recipient_type": "user",
            "recipient_id": "u-b",
            "amount": 0,
        },
    )
    r_neg = client.post(
        "/wallet/transfer",
        json={
            "sender_type": "user",
            "sender_id": "u-a",
            "recipient_type": "user",
            "recipient_id": "u-b",
            "amount": -5,
        },
    )
    # FastAPI validates amount > 0, so it's a 422 (pydantic) — either way we
    # don't want 200.
    assert r0.status_code in (400, 422)
    assert r_neg.status_code in (400, 422)


def test_earn_rules_public_catalog() -> None:
    r = client.get("/wallet/earn-rules")
    assert r.status_code == 200
    body = r.json()
    keys = {item["key"] for item in body}
    assert {"lesson_complete", "module_complete", "course_published"}.issubset(keys)


def test_top_earners_returns_a_list() -> None:
    r = client.get("/wallet/top-earners")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
