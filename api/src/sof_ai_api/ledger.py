"""
Educoin® ledger — the single place the in-app economy mutates.

Educoin® is a registered service mark of InventXR LLC (USPTO Reg. No.
5,935,271, Class 41). This module enforces:

1. **Single writer.** All balance changes go through `credit()`, `debit()`,
   and `transfer()` — never a raw `session.add(Wallet(...))` or direct
   balance arithmetic outside this file.

2. **Atomicity.** Every balance delta is applied alongside the Transaction
   row in the same DB transaction, so Wallet.balance stays in sync with
   the sum of the ledger.

3. **Idempotency for earn rules.** When `correlation_id` is provided for an
   earn (e.g. `"lesson:<program>:<slug>"`), a second credit with the same
   (owner, correlation_id, kind="earn") is a no-op. This lets callers
   re-run progress hooks safely.

4. **No negative balances on debit.** Debits that would overdraw raise
   `InsufficientFundsError`; callers must surface a 402 to the API layer.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .models import EducoinTransaction, Wallet, _utcnow


class InsufficientFundsError(Exception):
    """Raised when a debit or transfer would overdraw the wallet."""


class LedgerError(Exception):
    """Raised for structural ledger errors (e.g. self-transfer)."""


@dataclass(frozen=True)
class EarnRule:
    """Catalog of how many EDU a given contribution earns.

    Amounts are deliberate and small: the economy should feel active, not
    inflated. Changes here should be discussed — they're the spine of the
    in-app incentive system.
    """

    kind: str
    amount: int
    memo: str


EARN_RULES: dict[str, EarnRule] = {
    "lesson_complete": EarnRule("lesson_complete", 5, "Completed a lesson"),
    "module_complete": EarnRule("module_complete", 25, "Completed a module"),
    "capstone_shipped": EarnRule(
        "capstone_shipped", 100, "Shipped a capstone PR"
    ),
    "course_published": EarnRule(
        "course_published", 250, "Published a new course"
    ),
    "challenge_triaged": EarnRule(
        "challenge_triaged", 10, "Your challenge helped shape the product"
    ),
    "daily_streak": EarnRule("daily_streak", 1, "Daily streak"),
    "signup_bonus": EarnRule(
        "signup_bonus", 50, "Welcome to sof.ai — first Educoins on the house"
    ),
    # Journalism School of AI (OJS-aligned) earn rules.
    "found_journal": EarnRule(
        "found_journal", 300, "Founded a journal as editor-in-chief"
    ),
    "article_submitted": EarnRule(
        "article_submitted", 50, "Submitted a paper for peer review"
    ),
    "peer_review": EarnRule(
        "peer_review", 75, "Completed a peer review"
    ),
    "issue_published": EarnRule(
        "issue_published", 150, "Published a journal issue"
    ),
    "article_published": EarnRule(
        "article_published", 120, "An article of yours was published"
    ),
    # Auto-grader / exercise earn rules (DeepSeek + Claude graders share these).
    "exercise_attempted": EarnRule(
        "exercise_attempted", 5, "Attempted an AI-graded exercise"
    ),
    "exercise_passed": EarnRule(
        "exercise_passed", 20, "Passed an AI-graded exercise"
    ),
}


def get_or_create_wallet(
    session: Session, owner_type: str, owner_id: str
) -> Wallet:
    """Return the wallet for (owner_type, owner_id), creating a zero-balance
    row if it doesn't exist yet. Never commits — caller owns the transaction."""
    if owner_type not in ("user", "agent"):
        raise LedgerError(f"invalid owner_type: {owner_type}")
    if not owner_id:
        raise LedgerError("owner_id required")

    stmt = select(Wallet).where(
        Wallet.owner_type == owner_type, Wallet.owner_id == owner_id
    )
    wallet = session.exec(stmt).first()
    if wallet is None:
        wallet = Wallet(owner_type=owner_type, owner_id=owner_id, balance=0)
        session.add(wallet)
        session.flush()  # assign pk so later rows can reference it
    return wallet


def _has_earn(
    session: Session,
    owner_type: str,
    owner_id: str,
    correlation_id: str,
) -> bool:
    """Dedupe check for earn rules — has this owner already been credited
    for this correlation_id (e.g. a specific lesson)?"""
    stmt = select(EducoinTransaction).where(
        EducoinTransaction.owner_type == owner_type,
        EducoinTransaction.owner_id == owner_id,
        EducoinTransaction.correlation_id == correlation_id,
        EducoinTransaction.kind == "earn",
    )
    return session.exec(stmt).first() is not None


def credit(
    session: Session,
    owner_type: str,
    owner_id: str,
    amount: int,
    *,
    kind: str = "earn",
    memo: str = "",
    correlation_id: Optional[str] = None,
) -> Optional[EducoinTransaction]:
    """Credit a wallet. Returns the inserted Transaction, or None if this
    was a dedupe no-op (earn with an already-used correlation_id).

    `amount` must be positive.
    """
    if amount <= 0:
        raise LedgerError("credit amount must be positive")
    if kind not in ("earn", "award", "adjustment"):
        raise LedgerError(f"invalid credit kind: {kind}")

    if kind == "earn" and correlation_id and _has_earn(
        session, owner_type, owner_id, correlation_id
    ):
        return None

    wallet = get_or_create_wallet(session, owner_type, owner_id)
    wallet.balance += amount
    wallet.lifetime_earned += amount
    wallet.updated_at = _utcnow()

    tx = EducoinTransaction(
        owner_type=owner_type,
        owner_id=owner_id,
        amount=amount,
        kind=kind,
        memo=memo,
        correlation_id=correlation_id,
    )
    session.add(tx)
    session.add(wallet)
    # Wrap the insert in a SAVEPOINT so a constraint violation on
    # ux_earn_correlation rolls back only this credit — not the caller's
    # outer unit of work (e.g. the pending Enrollment / LessonCompletion
    # that triggered this earn). Without the nested transaction, a race
    # on the partial unique index would destroy the enrollment write too.
    nested = session.begin_nested()
    try:
        session.flush()
    except IntegrityError:
        # Race lost: a concurrent transaction inserted the same earn
        # (owner_type, owner_id, correlation_id) between our _has_earn()
        # check and our flush. The partial unique index on
        # EducoinTransaction ensures only one of the two can win; we
        # treat the loser as a dedupe no-op, matching the happy-path
        # _has_earn() short-circuit. The savepoint rollback keeps the
        # caller's outer transaction intact.
        nested.rollback()
        # The in-memory Wallet object was mutated before the flush; undo
        # the balance / lifetime_earned deltas so the cached view matches
        # what the DB actually holds.
        wallet.balance -= amount
        wallet.lifetime_earned -= amount
        return None
    return tx


def debit(
    session: Session,
    owner_type: str,
    owner_id: str,
    amount: int,
    *,
    kind: str = "spend",
    memo: str = "",
    correlation_id: Optional[str] = None,
) -> EducoinTransaction:
    """Debit a wallet. Raises InsufficientFundsError if it would overdraw.

    `amount` must be positive; the stored transaction has a negative sign
    so sum-of-amounts equals the balance.
    """
    if amount <= 0:
        raise LedgerError("debit amount must be positive")
    if kind not in ("spend", "adjustment"):
        raise LedgerError(f"invalid debit kind: {kind}")

    wallet = get_or_create_wallet(session, owner_type, owner_id)
    if wallet.balance < amount:
        raise InsufficientFundsError(
            f"balance {wallet.balance} < requested {amount}"
        )
    wallet.balance -= amount
    wallet.updated_at = _utcnow()

    tx = EducoinTransaction(
        owner_type=owner_type,
        owner_id=owner_id,
        amount=-amount,
        kind=kind,
        memo=memo,
        correlation_id=correlation_id,
    )
    session.add(tx)
    session.add(wallet)
    session.flush()
    return tx


def transfer(
    session: Session,
    sender_type: str,
    sender_id: str,
    recipient_type: str,
    recipient_id: str,
    amount: int,
    *,
    memo: str = "",
) -> tuple[EducoinTransaction, EducoinTransaction]:
    """Move `amount` from sender to recipient. Atomic on commit.

    Returns (out_tx, in_tx). The two rows share a correlation_id of the form
    "transfer:<uuid>" so auditors can pair them.
    """
    if amount <= 0:
        raise LedgerError("transfer amount must be positive")
    if (sender_type, sender_id) == (recipient_type, recipient_id):
        raise LedgerError("cannot transfer to yourself")

    corr = f"transfer:{uuid.uuid4()}"
    sender = get_or_create_wallet(session, sender_type, sender_id)
    recipient = get_or_create_wallet(session, recipient_type, recipient_id)
    if sender.balance < amount:
        raise InsufficientFundsError(
            f"balance {sender.balance} < requested {amount}"
        )

    sender.balance -= amount
    sender.lifetime_sent += amount
    sender.updated_at = _utcnow()

    recipient.balance += amount
    recipient.lifetime_received += amount
    recipient.updated_at = _utcnow()

    out_tx = EducoinTransaction(
        owner_type=sender_type,
        owner_id=sender_id,
        amount=-amount,
        kind="transfer_out",
        memo=memo,
        counterparty_type=recipient_type,
        counterparty_id=recipient_id,
        correlation_id=corr,
    )
    in_tx = EducoinTransaction(
        owner_type=recipient_type,
        owner_id=recipient_id,
        amount=amount,
        kind="transfer_in",
        memo=memo,
        counterparty_type=sender_type,
        counterparty_id=sender_id,
        correlation_id=corr,
    )
    session.add_all([sender, recipient, out_tx, in_tx])
    session.flush()
    return out_tx, in_tx


def apply_earn_rule(
    session: Session,
    owner_type: str,
    owner_id: str,
    rule_key: str,
    *,
    correlation_id: Optional[str] = None,
    memo_override: Optional[str] = None,
) -> Optional[EducoinTransaction]:
    """Convenience wrapper — credit based on the EARN_RULES catalog."""
    rule = EARN_RULES.get(rule_key)
    if rule is None:
        raise LedgerError(f"unknown earn rule: {rule_key}")
    return credit(
        session,
        owner_type,
        owner_id,
        rule.amount,
        kind="earn",
        memo=memo_override or rule.memo,
        correlation_id=correlation_id,
    )
