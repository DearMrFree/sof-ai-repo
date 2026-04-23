"""
Educoin® wallet routes.

Educoin® is a registered service mark of InventXR LLC (USPTO Reg. No.
5,935,271, Class 41).

Endpoints:
  GET  /wallet/{owner_type}/{owner_id}                 → balance + lifetime stats
  GET  /wallet/{owner_type}/{owner_id}/transactions    → paginated ledger view
  POST /wallet/transfer                                → move EDU from one owner to another
  GET  /wallet/top-earners                             → weekly leaderboard
  GET  /wallet/earn-rules                              → public catalog of earn rules
"""

from datetime import timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlmodel import Session, select

from ..db import get_session
from ..ledger import (
    EARN_RULES,
    InsufficientFundsError,
    LedgerError,
    apply_earn_rule,
    get_or_create_wallet,
    transfer,
)
from ..models import EducoinTransaction, Wallet, _utcnow
from ..settings import settings


def require_internal_auth(
    x_internal_auth: Optional[str] = Header(default=None),
) -> None:
    """Gate for internal / mutating Educoin routes.

    When ``settings.internal_api_key`` is set (production), requests must
    carry a matching ``X-Internal-Auth`` header — the Next.js proxy adds it
    server-side from the same env var, so only our own frontend can drive
    transfers. An empty ``internal_api_key`` disables the gate, which is
    what local dev and the pytest suite use (they hit the app via
    TestClient and don't forge headers).
    """
    expected = settings.internal_api_key
    if not expected:
        return
    if not x_internal_auth or x_internal_auth != expected:
        raise HTTPException(
            status_code=401,
            detail="Educoin® transfers require a valid internal auth header.",
        )

router = APIRouter(prefix="/wallet", tags=["wallet"])

OwnerType = Literal["user", "agent"]


class WalletOut(BaseModel):
    owner_type: str
    owner_id: str
    balance: int
    lifetime_earned: int
    lifetime_sent: int
    lifetime_received: int


class TransactionOut(BaseModel):
    id: int
    amount: int
    kind: str
    memo: str
    counterparty_type: Optional[str]
    counterparty_id: Optional[str]
    correlation_id: Optional[str]
    created_at: str


class TransferIn(BaseModel):
    sender_type: OwnerType
    sender_id: str = Field(min_length=1, max_length=80)
    recipient_type: OwnerType
    recipient_id: str = Field(min_length=1, max_length=80)
    amount: int = Field(gt=0, le=100_000)
    memo: str = Field(default="", max_length=280)


class TransferOut(BaseModel):
    out_tx_id: int
    in_tx_id: int
    sender_balance: int
    recipient_balance: int


class EarnRuleOut(BaseModel):
    key: str
    kind: str
    amount: int
    memo: str


class TopEarnerOut(BaseModel):
    owner_type: str
    owner_id: str
    earned_last_7d: int


def _serialize_wallet(w: Wallet) -> WalletOut:
    return WalletOut(
        owner_type=w.owner_type,
        owner_id=w.owner_id,
        balance=w.balance,
        lifetime_earned=w.lifetime_earned,
        lifetime_sent=w.lifetime_sent,
        lifetime_received=w.lifetime_received,
    )


def _serialize_tx(t: EducoinTransaction) -> TransactionOut:
    return TransactionOut(
        id=t.id or 0,
        amount=t.amount,
        kind=t.kind,
        memo=t.memo,
        counterparty_type=t.counterparty_type,
        counterparty_id=t.counterparty_id,
        correlation_id=t.correlation_id,
        created_at=t.created_at.isoformat(),
    )


class EarnIn(BaseModel):
    owner_type: OwnerType
    owner_id: str = Field(..., min_length=1)
    rule: str = Field(..., min_length=1)
    correlation_id: Optional[str] = None


class EarnOut(BaseModel):
    applied: bool
    rule: str
    amount: int
    balance: int


@router.post("/earn", response_model=EarnOut)
def earn(
    body: EarnIn,
    session: Session = Depends(get_session),
    _auth: None = Depends(require_internal_auth),
) -> EarnOut:
    """Award an earn rule to an owner. Idempotent on ``(owner, correlation_id)``
    so the Next.js grader proxy can retry safely. Requires the same internal
    auth gate as ``/transfer`` — public clients cannot self-credit."""
    rule = EARN_RULES.get(body.rule)
    if rule is None:
        raise HTTPException(status_code=400, detail=f"Unknown rule: {body.rule}")
    try:
        tx = apply_earn_rule(
            session,
            body.owner_type,
            body.owner_id,
            body.rule,
            correlation_id=body.correlation_id,
        )
    except LedgerError as exc:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    w = get_or_create_wallet(session, body.owner_type, body.owner_id)
    session.commit()
    session.refresh(w)
    return EarnOut(
        applied=tx is not None,
        rule=body.rule,
        amount=rule.amount,
        balance=w.balance,
    )


@router.get("/earn-rules", response_model=list[EarnRuleOut])
def list_earn_rules() -> list[EarnRuleOut]:
    """Public catalog — useful for showing the "how to earn" UI."""
    return [
        EarnRuleOut(key=k, kind=r.kind, amount=r.amount, memo=r.memo)
        for k, r in EARN_RULES.items()
    ]


@router.get("/top-earners", response_model=list[TopEarnerOut])
def top_earners(
    limit: int = 10,
    session: Session = Depends(get_session),
) -> list[TopEarnerOut]:
    """Leaderboard of earners (kind=earn or transfer_in) over the last 7 days."""
    limit = max(1, min(limit, 50))
    since = _utcnow() - timedelta(days=7)
    stmt = (
        select(
            EducoinTransaction.owner_type,
            EducoinTransaction.owner_id,
            func.sum(EducoinTransaction.amount).label("earned"),
        )
        .where(
            EducoinTransaction.created_at >= since,
            EducoinTransaction.amount > 0,
        )
        .group_by(EducoinTransaction.owner_type, EducoinTransaction.owner_id)
        .order_by(func.sum(EducoinTransaction.amount).desc())
        .limit(limit)
    )
    rows = session.exec(stmt).all()
    return [
        TopEarnerOut(
            owner_type=row[0], owner_id=row[1], earned_last_7d=int(row[2] or 0)
        )
        for row in rows
    ]


@router.get("/{owner_type}/{owner_id}", response_model=WalletOut)
def get_wallet(
    owner_type: OwnerType,
    owner_id: str,
    session: Session = Depends(get_session),
) -> WalletOut:
    """Return the wallet for (owner_type, owner_id). Creates a zero-balance
    wallet on first access so the frontend can render a card for anyone."""
    w = get_or_create_wallet(session, owner_type, owner_id)
    session.commit()
    session.refresh(w)
    return _serialize_wallet(w)


@router.get(
    "/{owner_type}/{owner_id}/transactions",
    response_model=list[TransactionOut],
)
def list_transactions(
    owner_type: OwnerType,
    owner_id: str,
    limit: int = 20,
    session: Session = Depends(get_session),
) -> list[TransactionOut]:
    limit = max(1, min(limit, 100))
    stmt = (
        select(EducoinTransaction)
        .where(
            EducoinTransaction.owner_type == owner_type,
            EducoinTransaction.owner_id == owner_id,
        )
        .order_by(EducoinTransaction.created_at.desc())
        .limit(limit)
    )
    rows = session.exec(stmt).all()
    return [_serialize_tx(t) for t in rows]


@router.post("/transfer", response_model=TransferOut)
def transfer_edu(
    body: TransferIn,
    session: Session = Depends(get_session),
    _auth: None = Depends(require_internal_auth),
) -> TransferOut:
    try:
        out_tx, in_tx = transfer(
            session,
            body.sender_type,
            body.sender_id,
            body.recipient_type,
            body.recipient_id,
            body.amount,
            memo=body.memo,
        )
    except InsufficientFundsError as exc:
        session.rollback()
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    except LedgerError as exc:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    sender = get_or_create_wallet(session, body.sender_type, body.sender_id)
    recipient = get_or_create_wallet(
        session, body.recipient_type, body.recipient_id
    )
    session.commit()
    session.refresh(sender)
    session.refresh(recipient)

    return TransferOut(
        out_tx_id=out_tx.id or 0,
        in_tx_id=in_tx.id or 0,
        sender_balance=sender.balance,
        recipient_balance=recipient.balance,
    )
