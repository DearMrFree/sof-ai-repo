"""
Journalism School of AI — journals, articles, peer reviews, issues.

Modeled after Open Journal Systems (OJS, https://pkp.sfu.ca/ojs) so that a
future phase can federate sof.ai journals to a real OJS instance via its
REST API without reshaping our data. For now everything lives natively.

Endpoints
  POST  /journals                              → found a journal (+300 EDU)
  GET   /journals                              → list journals
  GET   /journals/{slug}                       → journal detail + article counts
  POST  /journals/{slug}/articles              → submit an article (+50 EDU)
  GET   /journals/{slug}/articles              → list articles in the journal
  GET   /journals/{slug}/articles/{id}         → article detail + peer reviews
  POST  /journals/{slug}/articles/{id}/reviews → submit a peer review (+75 EDU)
  POST  /journals/{slug}/issues                → publish an issue (+150 EDU to EIC,
                                                  +120 EDU to each accepted article's submitter)

All mutating endpoints enforce ``require_internal_auth`` — the same shared-
secret gate as /wallet/transfer — so the public Fly backend can't be
driven directly without going through the Next.js proxy.
"""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..db import engine, get_session
from ..integrations.ojs import (
    mirror_article,
    mirror_issue,
    mirror_journal,
    mirror_review,
    ojs_enabled,
    resync_pending,
)
from ..ledger import apply_earn_rule
from ..models import (
    Journal,
    JournalArticle,
    JournalArticleRevision,
    JournalIssue,
    JournalPeerReview,
    _utcnow,
)
from ..seed_journal_ai import seed as seed_journal_ai
from .wallet import require_internal_auth

# --- OJS mirror helpers ------------------------------------------------------
# BackgroundTasks run after the response is sent and the request-scoped
# SQLModel session is closed, so every mirror task opens its own fresh
# session. We use ``Session(engine)`` directly here (not ``get_session``)
# because ``get_session`` is a FastAPI dependency generator — consuming it
# with ``next(...)`` outside the request cycle leaks the generator frame
# and bypasses its ``finally`` cleanup. ``with Session(engine)`` opens and
# closes the session cleanly. All four helpers are cheap no-ops when OJS
# is not configured.

def _mirror_journal_bg(journal_id: int) -> None:
    with Session(engine) as session:
        mirror_journal(session, journal_id)


def _mirror_article_bg(article_id: int) -> None:
    with Session(engine) as session:
        # Ensure the parent journal context exists in OJS first, then the
        # article. mirror_article handles the dependency internally.
        mirror_article(session, article_id)


def _mirror_review_bg(review_id: int) -> None:
    with Session(engine) as session:
        mirror_review(session, review_id)


def _mirror_issue_bg(issue_id: int) -> None:
    with Session(engine) as session:
        mirror_issue(session, issue_id)

router = APIRouter(prefix="/journals", tags=["journals"])

OwnerType = Literal["user", "agent"]
Recommendation = Literal[
    "accept", "minor_revisions", "major_revisions", "reject"
]


def _slugify(value: str) -> str:
    out = []
    prev_dash = False
    for ch in value.lower().strip():
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        elif ch in (" ", "-", "_"):
            if not prev_dash:
                out.append("-")
                prev_dash = True
    slug = "".join(out).strip("-")
    return slug[:80]


class JournalIn(BaseModel):
    slug: Optional[str] = Field(default=None, max_length=80)
    title: str = Field(..., min_length=2, max_length=200)
    description: str = Field(default="", max_length=2000)
    topic_tags: list[str] = Field(default_factory=list, max_length=20)
    editor_in_chief_type: OwnerType = "user"
    editor_in_chief_id: str = Field(..., min_length=1, max_length=80)


class JournalOut(BaseModel):
    id: int
    slug: str
    title: str
    description: str
    topic_tags: list[str]
    editor_in_chief_type: str
    editor_in_chief_id: str
    created_at: str
    article_count: int
    published_count: int


class ArticleIn(BaseModel):
    title: str = Field(..., min_length=2, max_length=300)
    abstract: str = Field(default="", max_length=4000)
    body: str = Field(default="", max_length=200_000)
    submitter_type: OwnerType = "user"
    submitter_id: str = Field(..., min_length=1, max_length=80)
    coauthors: list[str] = Field(default_factory=list, max_length=40)
    # Optional URL the author used as inspiration via the cross-journal
    # "Inspire from URL" flow. Persisted for provenance so reviewers can
    # always compare the published article against its starting point.
    source_url: Optional[str] = Field(default=None, max_length=2000)


class ArticleOut(BaseModel):
    id: int
    journal_slug: str
    title: str
    abstract: str
    body: str
    submitter_type: str
    submitter_id: str
    coauthors: list[str]
    status: str
    published_issue_id: Optional[int]
    submitted_at: str
    published_at: Optional[str]
    source_url: Optional[str] = None


class PeerReviewIn(BaseModel):
    reviewer_type: OwnerType = "user"
    reviewer_id: str = Field(..., min_length=1, max_length=80)
    recommendation: Recommendation
    comments: str = Field(default="", max_length=8000)


class PeerReviewOut(BaseModel):
    id: int
    article_id: int
    reviewer_type: str
    reviewer_id: str
    recommendation: str
    comments: str
    created_at: str


class IssueIn(BaseModel):
    volume: int = Field(..., ge=1, le=9999)
    number: int = Field(..., ge=1, le=9999)
    title: str = Field(default="", max_length=300)
    description: str = Field(default="", max_length=2000)
    # Articles to move from accepted → published in this issue.
    article_ids: list[int] = Field(default_factory=list, max_length=200)


class IssueOut(BaseModel):
    id: int
    journal_slug: str
    volume: int
    number: int
    title: str
    description: str
    published_at: str
    published_article_ids: list[int]


def _pack_tags(tags: list[str]) -> str:
    cleaned = [t.strip().lower() for t in tags if t.strip()]
    return ",".join(sorted({t[:40] for t in cleaned}))[:400]


def _unpack_tags(packed: str) -> list[str]:
    return [t for t in packed.split(",") if t]


def _serialize_journal(
    session: Session, j: Journal
) -> JournalOut:
    articles = session.exec(
        select(JournalArticle).where(JournalArticle.journal_slug == j.slug)
    ).all()
    return JournalOut(
        id=j.id or 0,
        slug=j.slug,
        title=j.title,
        description=j.description,
        topic_tags=_unpack_tags(j.topic_tags),
        editor_in_chief_type=j.editor_in_chief_type,
        editor_in_chief_id=j.editor_in_chief_id,
        created_at=j.created_at.isoformat(),
        article_count=len(articles),
        published_count=sum(1 for a in articles if a.status == "published"),
    )


def _serialize_article(a: JournalArticle) -> ArticleOut:
    return ArticleOut(
        id=a.id or 0,
        journal_slug=a.journal_slug,
        title=a.title,
        abstract=a.abstract,
        body=a.body,
        submitter_type=a.submitter_type,
        submitter_id=a.submitter_id,
        coauthors=[c for c in a.coauthors.split(",") if c],
        status=a.status,
        published_issue_id=a.published_issue_id,
        submitted_at=a.submitted_at.isoformat(),
        published_at=a.published_at.isoformat() if a.published_at else None,
        source_url=a.source_url,
    )


def _serialize_review(r: JournalPeerReview) -> PeerReviewOut:
    return PeerReviewOut(
        id=r.id or 0,
        article_id=r.article_id,
        reviewer_type=r.reviewer_type,
        reviewer_id=r.reviewer_id,
        recommendation=r.recommendation,
        comments=r.comments,
        created_at=r.created_at.isoformat(),
    )


@router.get("", response_model=list[JournalOut])
def list_journals(
    session: Session = Depends(get_session),
) -> list[JournalOut]:
    journals = session.exec(select(Journal).order_by(Journal.id.desc())).all()
    return [_serialize_journal(session, j) for j in journals]


@router.post(
    "",
    response_model=JournalOut,
    dependencies=[Depends(require_internal_auth)],
)
def create_journal(
    body: JournalIn,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
) -> JournalOut:
    slug = _slugify(body.slug or body.title)
    if not slug:
        raise HTTPException(status_code=400, detail="slug could not be derived")

    existing = session.exec(
        select(Journal).where(Journal.slug == slug)
    ).first()
    if existing:
        raise HTTPException(
            status_code=409, detail="A journal with that slug already exists."
        )

    j = Journal(
        slug=slug,
        title=body.title.strip(),
        description=body.description.strip(),
        topic_tags=_pack_tags(body.topic_tags),
        editor_in_chief_type=body.editor_in_chief_type,
        editor_in_chief_id=body.editor_in_chief_id,
    )
    session.add(j)
    # Pay the founding editor-in-chief. Dedupe via correlation_id so
    # re-running this op idempotently is safe.
    apply_earn_rule(
        session,
        body.editor_in_chief_type,
        body.editor_in_chief_id,
        "found_journal",
        correlation_id=f"journal:{slug}",
    )
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        existing = session.exec(
            select(Journal).where(Journal.slug == slug)
        ).first()
        if existing:
            return _serialize_journal(session, existing)
        raise
    session.refresh(j)
    if j.id is not None:
        background_tasks.add_task(_mirror_journal_bg, j.id)
    return _serialize_journal(session, j)


@router.get("/{slug}", response_model=JournalOut)
def get_journal(
    slug: str,
    session: Session = Depends(get_session),
) -> JournalOut:
    j = session.exec(select(Journal).where(Journal.slug == slug)).first()
    if not j:
        raise HTTPException(status_code=404, detail="Journal not found.")
    return _serialize_journal(session, j)


@router.get("/{slug}/articles", response_model=list[ArticleOut])
def list_articles(
    slug: str,
    session: Session = Depends(get_session),
) -> list[ArticleOut]:
    articles = session.exec(
        select(JournalArticle)
        .where(JournalArticle.journal_slug == slug)
        .order_by(JournalArticle.id.desc())
    ).all()
    return [_serialize_article(a) for a in articles]


@router.post(
    "/{slug}/articles",
    response_model=ArticleOut,
    dependencies=[Depends(require_internal_auth)],
)
def submit_article(
    slug: str,
    body: ArticleIn,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
) -> ArticleOut:
    j = session.exec(select(Journal).where(Journal.slug == slug)).first()
    if not j:
        raise HTTPException(status_code=404, detail="Journal not found.")

    coauthors = ",".join([c.strip()[:80] for c in body.coauthors if c.strip()])
    a = JournalArticle(
        journal_slug=slug,
        title=body.title.strip(),
        abstract=body.abstract.strip(),
        body=body.body,
        submitter_type=body.submitter_type,
        submitter_id=body.submitter_id,
        coauthors=coauthors,
        status="submitted",
        source_url=(body.source_url or "").strip() or None,
    )
    session.add(a)
    session.flush()  # need a.id for the correlation_id
    apply_earn_rule(
        session,
        body.submitter_type,
        body.submitter_id,
        "article_submitted",
        correlation_id=f"article:{slug}:{a.id}",
    )
    session.commit()
    session.refresh(a)
    if a.id is not None:
        background_tasks.add_task(_mirror_article_bg, a.id)
    return _serialize_article(a)


@router.get("/{slug}/articles/{article_id}", response_model=ArticleOut)
def get_article(
    slug: str,
    article_id: int,
    session: Session = Depends(get_session),
) -> ArticleOut:
    a = session.exec(
        select(JournalArticle).where(
            JournalArticle.journal_slug == slug,
            JournalArticle.id == article_id,
        )
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    return _serialize_article(a)


@router.get(
    "/{slug}/articles/{article_id}/reviews",
    response_model=list[PeerReviewOut],
)
def list_reviews(
    slug: str,
    article_id: int,
    session: Session = Depends(get_session),
) -> list[PeerReviewOut]:
    # Ensure the article belongs to the journal (scoped access).
    a = session.exec(
        select(JournalArticle).where(
            JournalArticle.journal_slug == slug,
            JournalArticle.id == article_id,
        )
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    reviews = session.exec(
        select(JournalPeerReview)
        .where(JournalPeerReview.article_id == article_id)
        .order_by(JournalPeerReview.id.desc())
    ).all()
    return [_serialize_review(r) for r in reviews]


@router.post(
    "/{slug}/articles/{article_id}/reviews",
    response_model=PeerReviewOut,
    dependencies=[Depends(require_internal_auth)],
)
def submit_review(
    slug: str,
    article_id: int,
    body: PeerReviewIn,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
) -> PeerReviewOut:
    a = session.exec(
        select(JournalArticle).where(
            JournalArticle.journal_slug == slug,
            JournalArticle.id == article_id,
        )
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    if a.submitter_type == body.reviewer_type and (
        a.submitter_id == body.reviewer_id
    ):
        raise HTTPException(
            status_code=400,
            detail="You can't peer-review your own submission.",
        )

    r = JournalPeerReview(
        article_id=article_id,
        reviewer_type=body.reviewer_type,
        reviewer_id=body.reviewer_id,
        recommendation=body.recommendation,
        comments=body.comments,
    )
    session.add(r)
    # Move the article forward on first review; later reviews don't change status.
    if a.status == "submitted":
        a.status = "under_review"
        session.add(a)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="You have already reviewed this article.",
        ) from None
    apply_earn_rule(
        session,
        body.reviewer_type,
        body.reviewer_id,
        "peer_review",
        correlation_id=f"review:{article_id}:{body.reviewer_type}:{body.reviewer_id}",
    )
    session.commit()
    session.refresh(r)
    if r.id is not None:
        background_tasks.add_task(_mirror_review_bg, r.id)
    return _serialize_review(r)


class RevisionOut(BaseModel):
    id: int
    article_id: int
    revision_no: int
    revised_by_type: str
    revised_by_id: str
    changelog: str
    body: str
    created_at: str


@router.get(
    "/{slug}/articles/{article_id}/revisions",
    response_model=list[RevisionOut],
)
def list_revisions(
    slug: str,
    article_id: int,
    session: Session = Depends(get_session),
) -> list[RevisionOut]:
    a = session.exec(
        select(JournalArticle).where(
            JournalArticle.journal_slug == slug,
            JournalArticle.id == article_id,
        )
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    revs = session.exec(
        select(JournalArticleRevision)
        .where(JournalArticleRevision.article_id == article_id)
        .order_by(JournalArticleRevision.revision_no.asc())
    ).all()
    return [
        RevisionOut(
            id=r.id or 0,
            article_id=r.article_id,
            revision_no=r.revision_no,
            revised_by_type=r.revised_by_type,
            revised_by_id=r.revised_by_id,
            changelog=r.changelog,
            body=r.body,
            created_at=r.created_at.isoformat(),
        )
        for r in revs
    ]


@router.post(
    "/_seed/journal-ai",
    dependencies=[Depends(require_internal_auth)],
)
def seed_journal_ai_route(
    session: Session = Depends(get_session),
) -> dict[str, object]:
    """Re-run the Journal AI seed. Idempotent. Admin-gated via internal auth."""
    return seed_journal_ai(session)


@router.get("/_ojs/status")
def ojs_status() -> dict[str, object]:
    """Report whether the OJS federation mirror is enabled.

    Does not require internal auth — useful for the frontend Journalism
    School page to badge a "federated with OJS" pill when the mirror is
    live.
    """
    return {"enabled": ojs_enabled()}


@router.post(
    "/_ojs/resync",
    dependencies=[Depends(require_internal_auth)],
)
def ojs_resync(
    session: Session = Depends(get_session),
) -> dict[str, int]:
    """Retry mirroring every un-synced journal/article/review/issue.

    Called after first standing up the OJS instance (to backfill existing
    sof.ai data) and any time the mirror has been temporarily down.
    Idempotent — rows already synced are skipped by id-null predicates.
    """
    return resync_pending(session)


@router.post(
    "/{slug}/issues",
    response_model=IssueOut,
    dependencies=[Depends(require_internal_auth)],
)
def publish_issue(
    slug: str,
    body: IssueIn,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
) -> IssueOut:
    j = session.exec(select(Journal).where(Journal.slug == slug)).first()
    if not j:
        raise HTTPException(status_code=404, detail="Journal not found.")

    issue = JournalIssue(
        journal_slug=slug,
        volume=body.volume,
        number=body.number,
        title=body.title.strip(),
        description=body.description.strip(),
    )
    session.add(issue)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Volume {body.volume} number {body.number} already exists.",
        ) from None

    # Flip accepted articles → published, credit each submitter once per
    # article. article_published is deduped by article id.
    published_ids: list[int] = []
    for aid in body.article_ids:
        a = session.exec(
            select(JournalArticle).where(
                JournalArticle.journal_slug == slug,
                JournalArticle.id == aid,
            )
        ).first()
        if not a:
            continue
        if a.status not in ("accepted", "under_review", "submitted"):
            continue
        a.status = "published"
        a.published_issue_id = issue.id
        a.published_at = _utcnow()
        session.add(a)
        apply_earn_rule(
            session,
            a.submitter_type,
            a.submitter_id,
            "article_published",
            correlation_id=f"article_published:{a.id}",
        )
        published_ids.append(a.id or 0)

    # Credit the editor-in-chief for publishing the issue.
    apply_earn_rule(
        session,
        j.editor_in_chief_type,
        j.editor_in_chief_id,
        "issue_published",
        correlation_id=f"issue:{slug}:{body.volume}:{body.number}",
    )
    session.commit()
    session.refresh(issue)
    if issue.id is not None:
        background_tasks.add_task(_mirror_issue_bg, issue.id)
    return IssueOut(
        id=issue.id or 0,
        journal_slug=issue.journal_slug,
        volume=issue.volume,
        number=issue.number,
        title=issue.title,
        description=issue.description,
        published_at=issue.published_at.isoformat(),
        published_article_ids=published_ids,
    )
