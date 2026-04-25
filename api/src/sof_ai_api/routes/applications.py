"""
Agent onboarding — applications, Devin first-pass vetting, trio sign-off.

The flow:

1. ``POST /applications`` (public) — anyone (independent agent, company
   onboarding their AI, human seeking their own AI) submits a pitch.
2. ``POST /applications/{id}/vet`` (internal-auth) — the Next.js proxy
   calls this once Devin has run an Anthropic vet against sof.ai's
   mission for human flourishing + the APA's 5 ethical principles. The
   result is persisted; on ``passed`` the proxy then mails the trio
   (Freedom, Garth Corea at APA, Esther Wojcicki).
3. ``POST /applications/{id}/review`` (internal-auth) — the Next.js
   proxy calls this once a reviewer (validated via HMAC-signed link)
   submits their yes/no/maybe + comment. Unique on
   (application_id, reviewer_email).
4. ``POST /applications/{id}/finalize`` (internal-auth) — once 3 reviews
   exist, the proxy calls this with Devin's synthesis and the route
   flips ``status`` to conditionally_accepted | declined.
5. ``GET /applications/{id}`` and ``GET /applications`` — read surfaces.

Mutating routes other than ``POST /applications`` are gated by the same
``X-Internal-Auth`` shared secret as the rest of the API so the public
Fly backend can't be driven directly without going through the Next.js
proxy.
"""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..db import get_session
from ..models import (
    AgentApplication,
    AgentApplicationReview,
    ApplicationComment,
    ApplicationLike,
    _utcnow,
)
from .wallet import require_internal_auth

router = APIRouter(prefix="/applications", tags=["applications"])


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# The trio that signs off on conditional acceptance. Membership change
# requires a code deploy on purpose — this is the steering committee for
# who joins sof.ai, not a runtime config knob.
TRIO_REVIEWERS: tuple[tuple[str, str], ...] = (
    ("freedom@thevrschool.org", "Dr. Freedom Cheteni"),
    ("GCorea@apa.org", "Garth Corea (APA)"),
    ("ewojcicki@gmail.com", "Esther Wojcicki"),
)

TRIO_EMAILS: frozenset[str] = frozenset(e.lower() for e, _ in TRIO_REVIEWERS)

ApplicantKind = Literal["independent_agent", "company_ai", "human_seeking"]
VetStatus = Literal["pending", "passed", "needs_revision", "rejected"]
ReviewVote = Literal["yes", "no", "maybe"]


# ---------------------------------------------------------------------------
# Pydantic IO
# ---------------------------------------------------------------------------


class SubmitApplicationIn(BaseModel):
    """Public submission payload for ``POST /applications``."""

    applicant_kind: ApplicantKind
    applicant_name: str = Field(..., min_length=1, max_length=200)
    # Plain str (not EmailStr) so we don't drag in pydantic[email] just for
    # this surface. Light validation below; the proxy enforces shape too.
    applicant_email: str = Field(..., min_length=3, max_length=200)
    org_name: str = Field(default="", max_length=200)
    agent_name: str = Field(default="", max_length=200)
    agent_url: str = Field(default="", max_length=400)
    mission_statement: str = Field(..., min_length=20, max_length=4000)
    apa_statement: str = Field(..., min_length=20, max_length=4000)
    public_review_url: str = Field(default="", max_length=400)
    public_listing: bool = False


class ApplicationOut(BaseModel):
    id: int
    applicant_kind: str
    applicant_name: str
    applicant_email: str
    org_name: str
    agent_name: str
    agent_url: str
    mission_statement: str
    apa_statement: str
    public_review_url: str
    public_listing: bool
    vet_status: str
    vet_reasoning: str
    vet_recommendation: str
    vet_at: Optional[str]
    status: str
    final_decision: str
    final_decision_at: Optional[str]
    final_reasoning: str
    submitted_at: str
    # Public-engagement signal — only meaningful for opt-in public listings.
    likes_count: int = 0
    comments_count: int = 0


class ReviewOut(BaseModel):
    id: int
    application_id: int
    reviewer_email: str
    reviewer_name: str
    vote: str
    comment: str
    created_at: str


class CommentOut(BaseModel):
    id: int
    application_id: int
    user_id: str
    user_name: str
    body: str
    created_at: str


class LikeIn(BaseModel):
    """Authenticated user upvoting an application."""

    user_id: str = Field(..., min_length=1, max_length=200)
    user_name: str = Field(default="", max_length=200)


class CommentIn(BaseModel):
    """Authenticated user posting a comment thread on an application."""

    user_id: str = Field(..., min_length=1, max_length=200)
    user_name: str = Field(default="", max_length=200)
    body: str = Field(..., min_length=1, max_length=4000)


class ApplicationDetailOut(ApplicationOut):
    reviews: list[ReviewOut]
    comments: list[CommentOut] = []


class VetIn(BaseModel):
    """Devin's first-pass vetting result, computed in the Next.js proxy.

    The proxy makes the Anthropic call (so the prompt + key live on the
    web side, like the rest of the review-chain machinery) and forwards
    a structured verdict here. ``vet_status`` decides what happens next:
    ``passed`` → emails go out to the trio; ``needs_revision`` → applicant
    is told what to fix; ``rejected`` → terminal.
    """

    vet_status: VetStatus
    reasoning: str = Field(default="", max_length=20000)
    recommendation: str = Field(default="", max_length=4000)


class ReviewIn(BaseModel):
    """One trio reviewer's recommendation.

    The Next.js proxy validates the HMAC-signed reviewer link, looks up
    the canonical email from TRIO_REVIEWERS, and forwards here.
    """

    reviewer_email: str = Field(..., min_length=3, max_length=200)
    vote: ReviewVote
    comment: str = Field(default="", max_length=4000)


class FinalizeIn(BaseModel):
    """Final decision after Devin synthesizes the trio's votes."""

    final_decision: Literal["conditionally_accepted", "declined"]
    final_reasoning: str = Field(default="", max_length=20000)


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------


def _count_engagement(
    session: Session, application_ids: list[int]
) -> tuple[dict[int, int], dict[int, int]]:
    """Return (likes_by_app_id, comments_by_app_id) for the given app IDs.

    Comments are filtered to ``hidden=False`` so soft-deleted ones don't
    inflate the public count or feed false signal into Devin's vet.
    """
    if not application_ids:
        return {}, {}
    likes: dict[int, int] = {aid: 0 for aid in application_ids}
    for like in session.exec(
        select(ApplicationLike).where(
            ApplicationLike.application_id.in_(application_ids)  # type: ignore[attr-defined]
        )
    ).all():
        likes[like.application_id] = likes.get(like.application_id, 0) + 1
    comments: dict[int, int] = {aid: 0 for aid in application_ids}
    for c in session.exec(
        select(ApplicationComment).where(
            ApplicationComment.application_id.in_(application_ids),  # type: ignore[attr-defined]
            ApplicationComment.hidden == False,  # noqa: E712
        )
    ).all():
        comments[c.application_id] = comments.get(c.application_id, 0) + 1
    return likes, comments


def _serialize_application(
    a: AgentApplication,
    *,
    likes_count: int = 0,
    comments_count: int = 0,
) -> ApplicationOut:
    return ApplicationOut(
        id=a.id or 0,
        applicant_kind=a.applicant_kind,
        applicant_name=a.applicant_name,
        applicant_email=a.applicant_email,
        org_name=a.org_name,
        agent_name=a.agent_name,
        agent_url=a.agent_url,
        mission_statement=a.mission_statement,
        apa_statement=a.apa_statement,
        public_review_url=a.public_review_url,
        public_listing=a.public_listing,
        vet_status=a.vet_status,
        vet_reasoning=a.vet_reasoning,
        vet_recommendation=a.vet_recommendation,
        vet_at=a.vet_at.isoformat() if a.vet_at else None,
        status=a.status,
        final_decision=a.final_decision,
        final_decision_at=a.final_decision_at.isoformat()
        if a.final_decision_at
        else None,
        final_reasoning=a.final_reasoning,
        submitted_at=a.submitted_at.isoformat(),
        likes_count=likes_count,
        comments_count=comments_count,
    )


def _serialize_comment(c: ApplicationComment) -> CommentOut:
    return CommentOut(
        id=c.id or 0,
        application_id=c.application_id,
        user_id=c.user_id,
        user_name=c.user_name,
        body=c.body,
        created_at=c.created_at.isoformat(),
    )


def _serialize_review(r: AgentApplicationReview) -> ReviewOut:
    return ReviewOut(
        id=r.id or 0,
        application_id=r.application_id,
        reviewer_email=r.reviewer_email,
        reviewer_name=r.reviewer_name,
        vote=r.vote,
        comment=r.comment,
        created_at=r.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("", response_model=ApplicationOut, status_code=201)
def submit_application(
    body: SubmitApplicationIn,
    session: Session = Depends(get_session),
) -> ApplicationOut:
    """Create a new application. Public — no auth required.

    The vetting + email + trio-sign-off flow is kicked off separately by
    the proxy (so we keep the public Fly endpoint free of the Anthropic /
    Resend dependencies). Submitting alone just persists the row in
    ``status="submitted"``.
    """
    application = AgentApplication(
        applicant_kind=body.applicant_kind,
        applicant_name=body.applicant_name.strip(),
        applicant_email=str(body.applicant_email).strip().lower(),
        org_name=body.org_name.strip(),
        agent_name=body.agent_name.strip(),
        agent_url=body.agent_url.strip(),
        mission_statement=body.mission_statement.strip(),
        apa_statement=body.apa_statement.strip(),
        public_review_url=body.public_review_url.strip(),
        public_listing=body.public_listing,
        status="submitted",
    )
    session.add(application)
    session.commit()
    session.refresh(application)
    return _serialize_application(application)


@router.get("", response_model=list[ApplicationOut])
def list_applications(
    session: Session = Depends(get_session),
    public_only: bool = False,
    limit: int = 100,
) -> list[ApplicationOut]:
    """List applications, newest first.

    ``public_only=true`` filters to applications where the applicant
    opted in to public review (``public_listing == True``). The
    /apply/public page uses this; the /admin dashboard uses the
    unfiltered list.
    """
    stmt = select(AgentApplication).order_by(
        AgentApplication.submitted_at.desc()
    )
    if public_only:
        stmt = stmt.where(AgentApplication.public_listing == True)  # noqa: E712
    rows = session.exec(stmt.limit(max(1, min(limit, 500)))).all()
    likes, comments = _count_engagement(session, [a.id for a in rows if a.id])
    return [
        _serialize_application(
            a,
            likes_count=likes.get(a.id or 0, 0),
            comments_count=comments.get(a.id or 0, 0),
        )
        for a in rows
    ]


@router.get("/{application_id}", response_model=ApplicationDetailOut)
def get_application(
    application_id: int,
    session: Session = Depends(get_session),
) -> ApplicationDetailOut:
    application = session.get(AgentApplication, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="application not found")
    reviews = session.exec(
        select(AgentApplicationReview)
        .where(AgentApplicationReview.application_id == application_id)
        .order_by(AgentApplicationReview.created_at.asc())
    ).all()
    comments = session.exec(
        select(ApplicationComment)
        .where(
            ApplicationComment.application_id == application_id,
            ApplicationComment.hidden == False,  # noqa: E712
        )
        .order_by(ApplicationComment.created_at.asc())
    ).all()
    likes_count = len(
        session.exec(
            select(ApplicationLike).where(
                ApplicationLike.application_id == application_id
            )
        ).all()
    )
    base = _serialize_application(
        application,
        likes_count=likes_count,
        comments_count=len(comments),
    )
    return ApplicationDetailOut(
        **base.model_dump(),
        reviews=[_serialize_review(r) for r in reviews],
        comments=[_serialize_comment(c) for c in comments],
    )


@router.post(
    "/{application_id}/vet",
    response_model=ApplicationOut,
    dependencies=[Depends(require_internal_auth)],
)
def record_vet(
    application_id: int,
    body: VetIn,
    session: Session = Depends(get_session),
) -> ApplicationOut:
    """Persist Devin's first-pass vetting result.

    Called by the Next.js proxy after it runs the Anthropic vet. The
    proxy is responsible for emailing the trio when ``vet_status="passed"``;
    we just record the verdict here and update the state machine.
    """
    application = session.get(AgentApplication, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="application not found")

    if application.status not in {"submitted", "vetting", "vetted_revise"}:
        raise HTTPException(
            status_code=409,
            detail=(
                f"application is in status {application.status!r}; "
                "must be submitted/vetting/vetted_revise to vet."
            ),
        )

    application.vet_status = body.vet_status
    application.vet_reasoning = body.reasoning
    application.vet_recommendation = body.recommendation
    application.vet_at = _utcnow()

    if body.vet_status == "passed":
        application.status = "trio_reviewing"
    elif body.vet_status == "needs_revision":
        application.status = "vetted_revise"
    elif body.vet_status == "rejected":
        application.status = "vetted_reject"

    session.add(application)
    session.commit()
    session.refresh(application)
    return _serialize_application(application)


@router.post(
    "/{application_id}/review",
    response_model=ApplicationDetailOut,
    dependencies=[Depends(require_internal_auth)],
)
def submit_review(
    application_id: int,
    body: ReviewIn,
    session: Session = Depends(get_session),
) -> ApplicationDetailOut:
    """Record one trio reviewer's vote.

    The proxy is responsible for HMAC-signature validation on the link
    the reviewer clicked; we trust ``reviewer_email`` is the canonical
    address that came out of that signed token. Email must match one of
    TRIO_REVIEWERS — anything else is a 403 (defense in depth: even if
    the proxy is compromised, nothing outside the trio can vote).
    """
    application = session.get(AgentApplication, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="application not found")

    reviewer_email = str(body.reviewer_email).strip().lower()
    if reviewer_email not in TRIO_EMAILS:
        raise HTTPException(
            status_code=403,
            detail="Only the steering trio (Freedom, Garth, Esther) may review.",
        )

    if application.status not in {"trio_reviewing", "conditionally_accepted", "declined"}:
        # Allow re-vote up until finalize lands — voters might want to
        # change their mind. After finalize the application is terminal.
        raise HTTPException(
            status_code=409,
            detail=(
                f"application is in status {application.status!r}; "
                "must be trio_reviewing to accept reviews."
            ),
        )
    if application.status in {"conditionally_accepted", "declined"}:
        raise HTTPException(
            status_code=409,
            detail="application is already finalized; reviews are closed.",
        )

    reviewer_name = next(
        (n for e, n in TRIO_REVIEWERS if e.lower() == reviewer_email),
        "",
    )

    # Upsert: if this reviewer already voted, update their existing row.
    existing = session.exec(
        select(AgentApplicationReview).where(
            AgentApplicationReview.application_id == application_id,
            AgentApplicationReview.reviewer_email == reviewer_email,
        )
    ).first()
    if existing:
        existing.vote = body.vote
        existing.comment = body.comment
        session.add(existing)
    else:
        try:
            session.add(
                AgentApplicationReview(
                    application_id=application_id,
                    reviewer_email=reviewer_email,
                    reviewer_name=reviewer_name,
                    vote=body.vote,
                    comment=body.comment,
                )
            )
            session.commit()
        except IntegrityError:
            # Race: another concurrent vote landed between our SELECT and
            # INSERT. Re-fetch and update instead.
            session.rollback()
            existing = session.exec(
                select(AgentApplicationReview).where(
                    AgentApplicationReview.application_id == application_id,
                    AgentApplicationReview.reviewer_email == reviewer_email,
                )
            ).first()
            if existing:
                existing.vote = body.vote
                existing.comment = body.comment
                session.add(existing)
    session.commit()
    session.refresh(application)
    return get_application(application_id, session)


@router.post(
    "/{application_id}/finalize",
    response_model=ApplicationOut,
    dependencies=[Depends(require_internal_auth)],
)
def finalize_application(
    application_id: int,
    body: FinalizeIn,
    session: Session = Depends(get_session),
) -> ApplicationOut:
    """Apply Devin's final synthesis after the trio has voted.

    Called by the proxy once it has at least the configured quorum of
    trio reviews and has run the synthesis Anthropic call. Sets the
    terminal status (``conditionally_accepted`` or ``declined``).
    """
    application = session.get(AgentApplication, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="application not found")

    if application.status != "trio_reviewing":
        raise HTTPException(
            status_code=409,
            detail=(
                f"application is in status {application.status!r}; "
                "must be trio_reviewing to finalize."
            ),
        )

    application.status = body.final_decision
    application.final_decision = body.final_decision
    application.final_decision_at = _utcnow()
    application.final_reasoning = body.final_reasoning
    session.add(application)
    session.commit()
    session.refresh(application)
    return _serialize_application(application)


# ---------------------------------------------------------------------------
# Public-engagement: likes + comments on opt-in public listings
# ---------------------------------------------------------------------------


def _require_public(application: AgentApplication) -> None:
    """Likes/comments are only available on opt-in public applications.

    Private applications can still be viewed by their applicant + the
    trio + admin, but they don't accumulate community signal because
    the applicant didn't ask for it.
    """
    if not application.public_listing:
        raise HTTPException(
            status_code=403,
            detail="This application is not opted-in to public review.",
        )


@router.post(
    "/{application_id}/like",
    response_model=ApplicationOut,
    dependencies=[Depends(require_internal_auth)],
)
def like_application(
    application_id: int,
    body: LikeIn,
    session: Session = Depends(get_session),
) -> ApplicationOut:
    """Authenticated user upvotes a publicly-listed application.

    Idempotent: liking twice is a no-op (unique constraint on
    (application_id, user_id) plus IntegrityError-tolerant insert).
    """
    application = session.get(AgentApplication, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="application not found")
    _require_public(application)

    user_id = body.user_id.strip()
    user_name = body.user_name.strip()

    existing = session.exec(
        select(ApplicationLike).where(
            ApplicationLike.application_id == application_id,
            ApplicationLike.user_id == user_id,
        )
    ).first()
    if not existing:
        try:
            session.add(
                ApplicationLike(
                    application_id=application_id,
                    user_id=user_id,
                    user_name=user_name,
                )
            )
            session.commit()
        except IntegrityError:
            session.rollback()  # concurrent like; still a no-op outcome.

    likes_count = len(
        session.exec(
            select(ApplicationLike).where(
                ApplicationLike.application_id == application_id
            )
        ).all()
    )
    comments_count = len(
        session.exec(
            select(ApplicationComment).where(
                ApplicationComment.application_id == application_id,
                ApplicationComment.hidden == False,  # noqa: E712
            )
        ).all()
    )
    return _serialize_application(
        application,
        likes_count=likes_count,
        comments_count=comments_count,
    )


@router.delete(
    "/{application_id}/like",
    response_model=ApplicationOut,
    dependencies=[Depends(require_internal_auth)],
)
def unlike_application(
    application_id: int,
    user_id: str,
    session: Session = Depends(get_session),
) -> ApplicationOut:
    """Authenticated user removes their like.

    Public-only — same gate as like.
    """
    application = session.get(AgentApplication, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="application not found")
    _require_public(application)

    existing = session.exec(
        select(ApplicationLike).where(
            ApplicationLike.application_id == application_id,
            ApplicationLike.user_id == user_id.strip(),
        )
    ).first()
    if existing:
        session.delete(existing)
        session.commit()

    likes_count = len(
        session.exec(
            select(ApplicationLike).where(
                ApplicationLike.application_id == application_id
            )
        ).all()
    )
    comments_count = len(
        session.exec(
            select(ApplicationComment).where(
                ApplicationComment.application_id == application_id,
                ApplicationComment.hidden == False,  # noqa: E712
            )
        ).all()
    )
    return _serialize_application(
        application,
        likes_count=likes_count,
        comments_count=comments_count,
    )


@router.post(
    "/{application_id}/comments",
    response_model=CommentOut,
    status_code=201,
    dependencies=[Depends(require_internal_auth)],
)
def post_comment(
    application_id: int,
    body: CommentIn,
    session: Session = Depends(get_session),
) -> CommentOut:
    """Authenticated user posts a comment on a public application."""
    application = session.get(AgentApplication, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="application not found")
    _require_public(application)

    body_text = body.body.strip()
    if not body_text:
        raise HTTPException(status_code=422, detail="comment body is empty")

    comment = ApplicationComment(
        application_id=application_id,
        user_id=body.user_id.strip(),
        user_name=body.user_name.strip(),
        body=body_text,
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return _serialize_comment(comment)


@router.get(
    "/{application_id}/comments",
    response_model=list[CommentOut],
)
def list_comments(
    application_id: int,
    session: Session = Depends(get_session),
) -> list[CommentOut]:
    """Public list of comments on an application (hides soft-deleted ones)."""
    application = session.get(AgentApplication, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="application not found")
    rows = session.exec(
        select(ApplicationComment)
        .where(
            ApplicationComment.application_id == application_id,
            ApplicationComment.hidden == False,  # noqa: E712
        )
        .order_by(ApplicationComment.created_at.asc())
    ).all()
    return [_serialize_comment(c) for c in rows]
