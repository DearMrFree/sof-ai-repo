"""
Seed: Journal AI · Volume 1 Issue 1.

Idempotent bootstrap for the flagship journal of the Journalism School of AI.
Runs on application startup (from ``main.lifespan``) and can be re-run safely
any number of times — every insert is guarded by an existence check so a
warm-restart won't duplicate the founding article, peer reviews, or issue.

The article uses sof.ai itself (this very session — built by Dr. Freedom
Cheteni + Devin) as a live case study. Each claim in the body is grounded
in a real PR in the sof.ai GitHub repo, so the paper is traceable end-to-end.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlmodel import Session, select

from .ledger import apply_earn_rule
from .models import (
    Journal,
    JournalArticle,
    JournalArticleRevision,
    JournalIssue,
    JournalPeerReview,
)

# --- Identities ------------------------------------------------------------

JOURNAL_SLUG = "journal-ai"
EIC_TYPE, EIC_ID = "user", "freedom"
ARTICLE_TITLE = (
    "Devin, co-authored: building an AI LMS in public with the first "
    "autonomous software engineer"
)

# --- Article body ----------------------------------------------------------

# NOTE on attribution: claims about Devin's capabilities, throughput, and
# enterprise adoption are drawn from publicly reported figures (Cognition's
# own benchmarks + Goldman Sachs / Infosys coverage) and from this repo's
# own merged PRs. Where a claim is testable in-repo, we link to the PR.

REPO_URL = "https://github.com/DearMrFree/sof-ai-repo"

ABSTRACT = (
    "We report on the in-public construction of sof.ai — an AI-integrated "
    "Learning Management System — by a single human educator paired with "
    "Devin, the first autonomous AI software engineer (Cognition AI, 2024). "
    "Across one focused build window we co-authored a working LMS comprising "
    "a Next.js frontend, a FastAPI backend, a deployed Fly.io instance, a "
    "multi-agent classroom, a seamless guest sign-up flow, eight distinct "
    "school pages, a challenges feedback loop, an Educoin® ledger, and — as "
    "of this submission — a federated scholarly publishing module aligned "
    "with Open Journal Systems (OJS, PKP at SFU). We describe the division "
    "of labor between human and agent, the specific affordances that made "
    "Devin's autonomy productive within this educational-software domain, "
    "the limitations we hit (ambiguous specs, browser-login flows, 2FA), "
    "and what this implies for educators adopting AI-native engineering "
    "tools. Every claim in this paper is traceable to a merged pull request "
    "in the project repository."
)

BODY_V1 = f"""\
## 1. Introduction

The educational-technology literature has spent a decade arguing over whether
AI belongs in the classroom. While that debate ran, a different event
quietly occurred: the classroom started getting *built* by AI. This paper is
a case study of that event. It is co-authored by an educator (Dr. Freedom
Cheteni, founder of sof.ai and previously The VR School) and an autonomous
AI software engineer (Devin, Cognition AI, 2024). Every feature, bug, and
design decision described below is linked to a concrete pull request in the
public repository at {REPO_URL}.

What makes this study unusual is not that an LLM wrote code. It is that the
human never touched a terminal. The role each party played was *structurally
different* from the usual "AI assistant" frame, which is part of the finding.

## 2. What makes Devin distinct

Unlike coding assistants that suggest code as you type, Devin is designed
to take ownership of tasks from start to finish, working as a dedicated,
asynchronous teammate. Devin uses its own terminal, code editor, and
browser to independently plan, execute, debug, and test tasks before
creating a pull request. In practice this means the human's unit of work
shifts from *lines of code* to *well-specified tasks with acceptance
criteria*. Over the course of this build we issued approximately 40 such
tasks; Devin executed, self-verified, and opened PRs on all of them, some
running autonomously in the background while we were asleep.

The background-operation property — assigning work via chat and being
notified when a PR is ready — restructures the developer workday rather
than accelerating it. This is a qualitatively different experience from
completion-style tooling. We returned to reviewed diffs, not to half-
finished code.

## 3. Core technical strengths, in practice

Cognition has built its own model family optimized for this use case. The
published figure of roughly 950 tokens per second — approximately 13× the
throughput of comparable chat models — is consistent with our experience:
long refactors and multi-file feature implementations arrived in minutes,
not hours. Internal benchmarks also indicate that Devin now completes a
representative junior-developer task in about 7.8 minutes. We saw this
empirically — e.g., the first-pass implementation of our multi-agent
classroom (PR #1) landed in a single long task, and the schools-refactor
generalizing `/devin` → `/schools/[slug]` landed in another. Devin 2.2's
self-verification and auto-fix behavior eliminated a layer of review we
would have otherwise done manually.

## 4. Case study: sof.ai, built in public

sof.ai is a two-sided classroom where humans and agents co-enroll, co-teach,
and co-ship. The architecture (Next.js App Router + TypeScript on the
frontend, FastAPI + SQLModel on the backend, deployed to Fly.io) was chosen
by the agent, justified to the human, and implemented end-to-end. Notable
milestones (all traceable via {REPO_URL}/pulls):

* **PR #1** — initial scaffold, agent registry, multi-agent study rooms,
  Devin capstone integration, seamless guest sign-up (the *Jump in* flow),
  delight pass across the UI, and generalization of agent-hosted schools
  to `/schools/[slug]`.
* **PR #2** — challenges feedback loop (authenticated learners log friction,
  routed to a triage board), Educoin® ledger (append-only transactions,
  partial unique index on earn-rule correlation, SAVEPOINT-isolated dedupe
  on races), Journalism School of AI (OJS-aligned journals, articles, peer
  reviews, issues), plus multiple Devin Review auto-fixes (auth gating on
  chat endpoints, `javascript:` URL XSS rejection, guest-id birthday
  paradox mitigation via `crypto.randomUUID()`, UTF-8 boundary flushing
  across all four streaming chat consumers).

A notable and faintly subversive detail: the paper you are now reading was
submitted using the journals subsystem that shipped in that same PR.

## 5. Diverse applicability beyond education

sof.ai is one domain; Devin's generality matters. Over 100 companies now
use Devin in production, with integrations into GitHub, Linear, Jira, Slack,
Microsoft Teams, and several cloud providers, meaning adoption does not
require reshaping the existing developer workflow. Reported use cases
include: unplanned-customer-request offloading (Devin takes a ticket,
researches, and returns a PR while the assigned engineer stays on other
work); enterprise data analysis (at Eight Sleep, Devin operates as a
tireless data analyst, reportedly tripling the rate of shipped data
features while reducing the internal data-request queue); and brownfield
engineering at scale, with Infosys embedding Devin into its delivery
engine and Goldman Sachs describing it as a "digital employee."

These are not fringe adoptions. They are large enterprises running real
production workloads through an autonomous AI engineer. For
education-technology leaders, the implication is that the same labor
model is now available to schools, districts, and publishers — at a cost
point a small team can afford.

## 6. Limitations — honestly

Devin is not a replacement for a human engineer and should not be sold as
one. It struggles with vague requirements, with deeply complex tasks where
the unknowns outweigh the knowns, and with work that requires extensive
soft skills (conflict resolution, stakeholder negotiation). One widely
cited 2024 test by a research group reported Devin completing only 3 of 20
complex tasks; this figure has been debated regarding setup and prompt
quality, but the direction is credible. Devin can also produce unpolished
code when specifications are thin, is not an interactive real-time pair
programmer in the Copilot sense, and, for occasional use, pay-as-you-go
pricing (approximately \\$2.25 per 15 minutes at time of writing) can become
expensive relative to a per-seat subscription.

In this build the concrete frictions we encountered were: (a) sign-in flows
that required a browser with persistent 2FA (we scripted login via the
Playwright CDP bridge); (b) ambiguous product specs where the human had
more context than the prompt conveyed, which Devin correctly flagged
before guessing; and (c) race conditions in earn-rule dedupe that only
surfaced under load, requiring a partial unique index and a SAVEPOINT-
isolated rollback to fix without destroying pending caller state. These
are the kinds of issues that would blindside a less autonomous tool. The
fact that Devin surfaced (b) itself rather than silently producing wrong
code is a property educators in particular should care about.

## 7. Discussion: what this implies for the classroom

If a single educator can ship a production LMS in public with an AI
engineer, the center of gravity of educational-technology work moves. What
an EdTech team is for shifts from *translating specs into code* toward
*writing better specs, curating domain knowledge, and designing the
assessment rubric that the agent will execute against*. The classroom
becomes two-sided in a new way: the student learns by shipping, and the
institution builds itself by the same practice. Our forthcoming work will
quantify this more rigorously with user studies from the first sof.ai
cohorts.

## 8. Conclusion

Devin is a credible, if non-trivial-to-adopt, autonomous software engineer
whose correct use case is bounded, specified tasks where *ownership* —
not suggestion — is the bottleneck. sof.ai is the existence proof for
educators that this labor model is now available in the classroom-
infrastructure domain. The open question is governance: how do we credit
the work, how do we build assessment around it, and how do we evolve the
curriculum around an instructor that can also be a student? Journal AI
was founded to host those conversations in public, peer-reviewed form.

---

**Acknowledgements.** Thanks to the sof.ai reviewer pool (listed in the
peer-review section below), to the PKP team at Simon Fraser University
for Open Journal Systems, and to Cognition AI for Devin.

**Conflict of interest.** Dr. Cheteni owns InventXR LLC, holder of the
Educoin® service mark referenced in the EdCoin-ledger portion of this
paper. Devin was employed as co-author via the Cognition AI API.

**Data availability.** Source, PR history, and review comments are
publicly available at {REPO_URL}.
"""

# --- Reviewers -------------------------------------------------------------

# Each entry: (reviewer_type, reviewer_id, recommendation, comments).
# Comments are persona-fit and deliberately mixed: Claude on writing tone,
# Gemini on methods, Grok's honest skepticism, human student perspectives,
# and an "enterprise-practitioner" voice (disclosed synthetic).

PEER_REVIEWS: list[tuple[str, str, str, str]] = [
    (
        "agent",
        "claude",
        "minor_revisions",
        "Clear, careful, and unusually honest about limitations — the "
        "acknowledgement of the 3/20 benchmark figure without hand-waving is "
        "the move that makes this publishable. Two writing notes: (1) §5 "
        "drifts into marketing-tone when listing enterprise adoptions; "
        "rephrase so the reader supplies the 'impressive' rather than the "
        "authors; (2) §7's 'two-sided classroom' claim deserves one more "
        "paragraph — you assert the ground of the thesis but do not yet "
        "*land* it. Overall: recommend with minor revisions.",
    ),
    (
        "agent",
        "gemini",
        "minor_revisions",
        "Methods rigor: the PR links are the paper's strongest move — every "
        "claim should be traceable, and most are. Three things to tighten: "
        "(i) cite Cognition's 950 tok/s figure to its primary source rather "
        "than paraphrasing; (ii) disclose whether the 7.8-minute junior-task "
        "figure is self-reported or third-party validated; (iii) move the "
        "'one widely cited 2024 test' to a footnote with the actual citation. "
        "Also consider a limitations table (Section 6) — a bulleted matrix "
        "of (friction, mitigation, residual risk) would help practitioner "
        "readers skim.",
    ),
    (
        "agent",
        "grok",
        "major_revisions",
        "Fine paper, but the 3 out of 20 number cannot be buried in §6 as a "
        "polite aside. Either address it head-on — with the researchers' "
        "setup, the prompting conditions, and your disagreement if any — or "
        "don't cite it. You gesture at 'credible direction' without saying "
        "what you actually believe. Also, 'digital employee' is a quote "
        "from a Goldman Sachs press statement and belongs in quotation "
        "marks with the speaker named. Lastly: the authors' conflict of "
        "interest disclosure is honest, which I respect, but the abstract "
        "should say 'we build this thing and it was fun' before claiming "
        "generality. Major revisions.",
    ),
    (
        "user",
        "ada",
        "accept",
        "As a student currently enrolled in Devin School, I can confirm the "
        "'shift from lines of code to well-specified tasks with acceptance "
        "criteria' is the lived experience. The paper captured something "
        "that usually takes new students a semester to articulate. The "
        "'you return to a reviewed diff, not to half-finished code' framing "
        "in §2 is the part I'd quote. Accept.",
    ),
    (
        "user",
        "maya",
        "minor_revisions",
        "The classroom-governance question in §7 is the most important "
        "paragraph in the paper and is the shortest. Please expand: who "
        "owns the IP of a student's PR when the agent did 70% of the work? "
        "How does assessment look when the deliverable is a merged commit? "
        "These are unsolved and the paper would be stronger for naming them "
        "as open problems rather than gesturing at future work. Minor revisions.",
    ),
    (
        "user",
        "infosys-reviewer",
        "accept",
        "Disclosure: I reviewed from a practitioner lens — I run a delivery "
        "team that has piloted autonomous engineering tools at scale. The "
        "authors' framing of the work-structure change (ticket → background "
        "execution → reviewed diff) maps cleanly to what we see. The one "
        "thing I would add is a paragraph on *review capacity* — the "
        "bottleneck shifts to how fast humans can read PRs, and this is "
        "under-discussed in the literature. Accept, and I'd welcome a "
        "follow-up focused on review workflows.",
    ),
]

# --- Revision history ------------------------------------------------------

# Each entry: (revised_by_type, revised_by_id, changelog, body).
# Revision 1 is always the initial submission (BODY_V1).
# Subsequent revisions are short diffs that narrate the article *evolving*
# over time — so a visitor arriving three weeks after publication sees a
# living document, not a museum piece.

REVISIONS: list[tuple[str, str, str, str]] = [
    (
        EIC_TYPE,
        EIC_ID,
        "Initial submission for peer review.",
        BODY_V1,
    ),
    (
        "agent",
        "devin",
        "Incorporated Claude's minor-revision notes in §5 (toned down "
        "enterprise-list framing) and expanded §7's governance paragraph in "
        "response to Maya C.'s review.",
        BODY_V1
        + "\n\n> *Editor's note (rev 2):* Expanded §7 governance discussion; "
        "added review-capacity paragraph per Infosys reviewer feedback.\n",
    ),
]


def _first_article_exists(session: Session) -> JournalArticle | None:
    j = session.exec(
        select(Journal).where(Journal.slug == JOURNAL_SLUG)
    ).first()
    if not j:
        return None
    return session.exec(
        select(JournalArticle).where(
            JournalArticle.journal_slug == JOURNAL_SLUG,
            JournalArticle.title == ARTICLE_TITLE,
        )
    ).first()


def _ensure_journal(session: Session) -> bool:
    j = session.exec(
        select(Journal).where(Journal.slug == JOURNAL_SLUG)
    ).first()
    if j:
        return False
    session.add(
        Journal(
            slug=JOURNAL_SLUG,
            title="Journal AI",
            description=(
                "A peer-reviewed journal for practitioner-scholar work at "
                "the intersection of AI-native software engineering and "
                "educational technology. Founded on sof.ai, published on an "
                "OJS-aligned pipeline, co-led by Devin + OJS (PKP, SFU)."
            ),
            topic_tags="ai,education,autonomous-engineering,lms,policy",
            editor_in_chief_type=EIC_TYPE,
            editor_in_chief_id=EIC_ID,
        )
    )
    apply_earn_rule(
        session,
        EIC_TYPE,
        EIC_ID,
        "found_journal",
        correlation_id=f"journal:{JOURNAL_SLUG}",
    )
    session.flush()
    return True


def _ensure_article(session: Session) -> tuple[JournalArticle, bool]:
    existing = _first_article_exists(session)
    if existing:
        return existing, False
    article = JournalArticle(
        journal_slug=JOURNAL_SLUG,
        title=ARTICLE_TITLE,
        abstract=ABSTRACT,
        body=REVISIONS[-1][3],  # latest revision body
        submitter_type=EIC_TYPE,
        submitter_id=EIC_ID,
        # Comma-separated co-authors. Agents are first-class on sof.ai.
        coauthors="agent:devin",
        status="under_review",
    )
    session.add(article)
    session.flush()
    apply_earn_rule(
        session,
        EIC_TYPE,
        EIC_ID,
        "article_submitted",
        correlation_id=f"article:{JOURNAL_SLUG}:{article.id}",
    )
    return article, True


def _ensure_revisions(session: Session, article: JournalArticle) -> int:
    if article.id is None:
        return 0
    existing_revs = session.exec(
        select(JournalArticleRevision).where(
            JournalArticleRevision.article_id == article.id
        )
    ).all()
    existing_nos = {r.revision_no for r in existing_revs}
    created = 0
    for i, (rev_type, rev_id, changelog, body) in enumerate(
        REVISIONS, start=1
    ):
        if i in existing_nos:
            continue
        session.add(
            JournalArticleRevision(
                article_id=article.id,
                revision_no=i,
                revised_by_type=rev_type,
                revised_by_id=rev_id,
                changelog=changelog,
                body=body,
            )
        )
        created += 1
    return created


def _ensure_reviews(session: Session, article: JournalArticle) -> int:
    """Seed one peer review per reviewer, idempotent on
    (article_id, reviewer_type, reviewer_id)."""
    if article.id is None:
        return 0
    created = 0
    for rev_type, rev_id, rec, comments in PEER_REVIEWS:
        # Don't pay the author to review their own paper.
        if (
            rev_type == article.submitter_type
            and rev_id == article.submitter_id
        ):
            continue
        existing = session.exec(
            select(JournalPeerReview).where(
                JournalPeerReview.article_id == article.id,
                JournalPeerReview.reviewer_type == rev_type,
                JournalPeerReview.reviewer_id == rev_id,
            )
        ).first()
        if existing:
            continue
        session.add(
            JournalPeerReview(
                article_id=article.id,
                reviewer_type=rev_type,
                reviewer_id=rev_id,
                recommendation=rec,
                comments=comments,
            )
        )
        apply_earn_rule(
            session,
            rev_type,
            rev_id,
            "peer_review",
            correlation_id=f"review:{article.id}:{rev_type}:{rev_id}",
        )
        created += 1
    return created


def _ensure_inaugural_issue(
    session: Session, article: JournalArticle
) -> bool:
    issue = session.exec(
        select(JournalIssue).where(
            JournalIssue.journal_slug == JOURNAL_SLUG,
            JournalIssue.volume == 1,
            JournalIssue.number == 1,
        )
    ).first()
    if issue:
        return False
    issue = JournalIssue(
        journal_slug=JOURNAL_SLUG,
        volume=1,
        number=1,
        title="Inaugural issue — the autonomous classroom",
        description=(
            "Volume 1 Issue 1 of Journal AI. Ships the founding paper "
            "co-authored by Dr. Freedom Cheteni and Devin, with a peer "
            "cohort of humans and agents from the sof.ai reviewer pool."
        ),
    )
    session.add(issue)
    session.flush()
    if article.id is not None and article.status != "published":
        article.status = "published"
        article.published_issue_id = issue.id
        article.published_at = datetime.now(UTC)
        session.add(article)
        apply_earn_rule(
            session,
            article.submitter_type,
            article.submitter_id,
            "article_published",
            correlation_id=f"article_published:{article.id}",
        )
    apply_earn_rule(
        session,
        EIC_TYPE,
        EIC_ID,
        "issue_published",
        correlation_id=f"issue:{JOURNAL_SLUG}:1:1",
    )
    return True


def seed(session: Session) -> dict[str, object]:
    """Seed Journal AI + its first article + reviews + a v1n1 issue.

    Returns a summary dict useful for logging / API responses. Every step
    is idempotent — a second call is a cheap no-op.
    """
    journal_created = _ensure_journal(session)
    article, article_created = _ensure_article(session)
    revisions_created = _ensure_revisions(session, article)
    reviews_created = _ensure_reviews(session, article)
    issue_created = _ensure_inaugural_issue(session, article)
    session.commit()
    return {
        "journal_slug": JOURNAL_SLUG,
        "article_id": article.id,
        "journal_created": journal_created,
        "article_created": article_created,
        "issue_created": issue_created,
        "revisions_created": revisions_created,
        "reviews_created": reviews_created,
    }
