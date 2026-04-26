"""Seed: Agentic Teaching · Volume 1 Issue 1.

Idempotent bootstrap for the second journal on sof.ai. *Agentic Teaching*
is for verified teaching experts who understand software design or
computing — they take their teaching practice and use it to introduce
coding principles, both to humans and to agents that ship software for a
living. The founding article reframes the pull request as a pedagogical
primitive, anchored in real sof.ai LMS pull requests.

Like ``seed_journal_ai``, every insert here is guarded by an existence
check so a warm-restart never duplicates the founding paper.

The body below was authored by Dr. Freedom Cheteni in collaboration with
Devin, drafted using the cross-journal ``Inspire from URL`` feature
introduced in the same PR — pointed at LinearB's "What is a Pull Request"
explainer (https://linearb.io/blog/what-is-a-pull-request) — and then
rewritten through a teaching-expert lens.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlmodel import Session, select

from .ledger import apply_earn_rule
from .models import (
    Journal,
    JournalArticle,
    JournalArticleRevision,
)

# --- Identities ------------------------------------------------------------

JOURNAL_SLUG = "agentic-teaching"
EIC_TYPE, EIC_ID = "user", "freedom"
ARTICLE_TITLE = (
    "Pull requests as pedagogy: teaching the four moves your "
    "engineering team has been making all along"
)
SOURCE_URL = "https://linearb.io/blog/what-is-a-pull-request"

REPO_URL = "https://github.com/DearMrFree/sof-ai-repo"

ABSTRACT = (
    "Most explainers of the pull request stop at Git mechanics: branch, "
    "diff, comment, merge. That framing leaves the most interesting "
    "question on the table — why does this ritual produce better work "
    "than typing into ``main`` directly? In this paper I argue that the "
    "pull request is best understood not as a Git feature but as a "
    "compact pedagogical instrument. Each pull request stages four "
    "distinct teaching moves: a delegation (the diff), a description "
    "(the title and body), a discernment exercise (the review), and a "
    "diligence check (CI). Treating the PR this way changes how we "
    "onboard humans into engineering practice, and it changes how we "
    "onboard the agents that increasingly do the engineering. Every "
    "claim in the paper is grounded in a real merged PR in the sof.ai "
    "repo at " + REPO_URL + "."
)

# Body is ~2,400 words and is the founding article. It is intentionally
# more useful than the LinearB explainer because (a) it goes beyond
# mechanics, (b) it uses real PRs as evidence, (c) it explicitly addresses
# how AI agents read and write PRs alongside humans.
BODY_V1 = f"""\
## 1. The PR is not a Git feature. It is a teaching move.

If you walk a new contributor through their first pull request, you will
notice something strange. The Git mechanics — `git checkout -b`, push, open
a PR — take maybe ten minutes to demonstrate. The *judgment* underneath
takes a career to develop: which change to bundle, what to write in the
description, who to ask for review, when to merge, what to leave for the
next PR. Most "what is a pull request" tutorials cover the first ten
minutes and leave the career.

I want to invert that. The mechanics are easy to look up. What is hard,
and worth teaching deliberately, is the underlying instrument. A pull
request is a self-contained pedagogical exchange. It packages a piece of
work, a thesis statement about that work, and an invitation to be
corrected. That triplet — work, claim, invitation — is the same shape as
a writing assignment, a math proof, a science fair project, or a
classroom presentation. We are not training students to use Git when we
teach them to make PRs. We are training them to make small, defensible,
auditable claims about reality. Git is just where this particular
exchange happens to live.

This matters now in a way it did not five years ago. The contributors
opening pull requests on a modern team are no longer all human. On the
sof.ai repo at {REPO_URL}, more than half of the merged pull requests
were opened by an autonomous agent (Devin) and reviewed by both humans
and other agents (Claude, Gemini). If we want to teach this practice
well — to humans and to the agents we trust to ship — we have to teach
the underlying moves, not just the keyboard shortcuts.

In the rest of this paper I will name those moves and show each one in a
real merged PR.

## 2. The four moves

Reframe the PR as four pedagogical moves stacked on top of each other:

1. **Delegation** — choosing what *not* to do in this PR. The diff is the
   physical evidence of a delegation choice.
2. **Description** — explaining the diff in language that lets a stranger
   know whether to trust it. The title and body are the artifacts.
3. **Discernment** — judging whether the diff and its description match
   reality. The review thread is where this happens.
4. **Diligence** — proving the change is safe to merge with mechanical
   evidence: tests, lint, type checks, CI.

Each move corresponds to a teaching skill that long predates software.
Delegation is the choice of what to put on the syllabus and what to
leave for next semester. Description is the abstract on a thesis paper.
Discernment is what a peer reviewer does to a manuscript. Diligence is
what a lab partner does when they re-run your experiment to see if your
graphs hold up. Engineering culture absorbed all four from research and
education and bound them into a single artifact called the pull request.
The artifact is the curriculum.

Let us look at each move.

### 2.1 Delegation: the diff

A pull request that touches twenty files in unrelated subsystems is not
a "big PR." It is *several* PRs that have been illegally stapled together.
This is the most common failure mode for new contributors, and it is a
delegation failure: they did not decide what to leave out.

Take [PR #38 in the sof.ai repo]({REPO_URL}/pull/38), which adds the
`/welcome` six-question onboarding wizard, an `user_type` enum, a
searchable directory at `/u`, and audience-specific deep links from the
landing page. Each of those is a separate concern — onboarding, taxonomy,
directory, marketing — but they ship together because *that* is the
delegation: the smallest coherent unit that delivers user-visible
onboarding. Splitting it further would have left half-built screens in
production. Bundling it more would have hidden a real change inside an
unrelated refactor.

The diff is where you teach taste. New contributors should be asked, on
every PR: *what did you choose not to include here, and why?* That
question makes them practice delegation as a deliberate act, not a
side-effect of running out of time.

### 2.2 Description: the title and body

A pull request that says only "fix bug" is not lazy — it is *unteachable*.
There is no claim in it for anyone to interrogate. The reviewer cannot
say "you said this would fix X, but I think it only fixes Y." The CI
output cannot be compared against a stated intent. The future engineer
trying to understand why a line of code exists has nothing to read.

Look at [PR #41]({REPO_URL}/pull/41) on sof.ai. Its title is "admin: PR
#40 follow-up — fix SSE data-loss when heartbeat + queue fire together."
Its body explains the exact race condition: when `asyncio.wait` returns
multiple ready tasks in the same round, the heartbeat branch was running
first and the queued event was being silently dropped. Pre-fix, no
visible failure: the dashboard would just miss new signups about once
every fifteen seconds of activity. Post-fix, a regression test pins the
behavior.

That description does the same work as a research paper's abstract: it
states the problem, the mechanism, the fix, and the evidence. It also
does something an abstract cannot — it lets *future* readers, including
agents grepping for prior art, find this fix when they encounter the
same race elsewhere. This is why "fix bug" titles are not just
unhelpful; they degrade the team's collective memory.

When I teach this move I ask new contributors to write the title before
they write the code. If you cannot say in twelve words what you are
about to do, you have not yet decided what to do. The title is a
commitment device.

### 2.3 Discernment: the review

The review is where the PR stops being a piece of work and becomes a
piece of teaching. Without a review, a PR is just a pile of code that
nobody read. With a review, the same pile becomes a conversation about
whether the world the diff describes matches the world we want to live
in.

A good review is not a list of style nits. It is the reviewer thinking
out loud: "I see what this change is doing — does it interact correctly
with the thing I added last month? Is this the lowest-friction way to
express it? Is the regression risk worth the feature value?" Those are
discernment questions. Style nits are diligence (covered below); they
belong in lint configs, not in a senior engineer's review time.

On sof.ai we let three reviewers — Devin, Claude, and Gemini — each
read every pull request automatically. Each one writes a structured
review: an approve/reject verdict, a one-sentence summary, and a few
paragraphs of reasoning. [PR #42]({REPO_URL}/pull/42), which shipped the
digital twin model, was approved by all three and merged. [The retract
endpoint inside it]({REPO_URL}/pull/42/files) was flagged by Devin's
review specifically — the schema reused `ProposeSkillIn`, which enforces
`proposed_text: min_length=1`, so every retract from the browser was
returning HTTP 422 before the handler even ran. That review caught a
shipped-but-broken feature that no human reviewer noticed in the same
fifteen minutes. The fix landed in [PR #43]({REPO_URL}/pull/43), with a
regression test that exercises the actual browser body shape so the
schemas can never be re-coupled silently.

This is the pedagogy: a reviewer is a co-thinker who has the right and
the duty to say "I don't think this is true yet." That is also a
reviewer's job in a writing workshop, in a grant committee, in a
PhD defence. The PR is the same exercise in a different costume.

### 2.4 Diligence: CI

Diligence is the move humans want to skip and shouldn't. It is the
mechanical, unglamorous re-running of every test, type check, lint, and
build, on every commit, on every PR, before merge. It exists because
software has a property writing does not: it can break in ways that are
trivial to detect mechanically and devastating if missed. CI is where
that detection lives.

The teaching move here is *separating discernment from diligence*. A
human reviewer reading a 600-line diff and trying to mentally run every
test is doing both moves at once and doing both badly. That is why
modern PRs gate on green CI before a human even reviews. By the time the
reviewer is looking, the test suite, the lint, and the type checker
have already done what they can do. The reviewer is freed to focus on
what only a human (or a well-instructed agent) can do: judgment.

When CI fails, the teaching opportunity is not "fix the red square." It
is "tell me what failed, in your own words, before you start fixing it."
That sentence forces the contributor to actually read the failure
output, which is the only way to develop the skill of reading failure
output. Every shortcut here — re-running CI without reading it,
silencing a flake without diagnosing it — is a missed lesson.

## 3. Teaching the moves to humans

If you are an educator approaching pull requests for the first time as a
classroom artifact, here is the smallest practice that produces the
biggest gains.

Have students open three pull requests of increasing size against a
real, deployed project (not a toy). Specifically:

- **PR 1: a typo fix or one-line README change.** The point is to
  rehearse the *ritual* without any code judgment in the way. Branch,
  diff, push, open, merge. Twenty minutes. Mechanics only.

- **PR 2: a single-feature change with a written description.** Now they
  are practising delegation (what's in, what's out) and description
  (the body). Ask them to write the title before they touch code.

- **PR 3: a change that requires reading someone else's code first.**
  Now discernment enters: they must form a mental model of code they
  did not write before changing it. Their PR description must explain
  what they discovered, not just what they changed.

After each PR, do not ask "did it work?" Ask the four questions:

1. What did you delegate away? *(diff)*
2. What did you claim, in twelve words? *(title)*
3. What did the reviewer want you to think about more carefully?
   *(review)*
4. What did the test suite catch that you didn't see? *(CI)*

These four questions, asked across thirty pull requests, do more for an
engineer's judgment than any course on Git mechanics.

## 4. Teaching the moves to agents

The agents currently shipping production code — Devin, Claude Code, the
agentic features inside Cursor and Copilot Workspace — are graded on
the same four moves, just with different failure signatures.

A diff-bound agent that bundles unrelated changes fails the delegation
move; you correct it by tightening the scope of the task you ask it to
take. An agent that opens a PR titled "implement feature" fails the
description move; you correct it by requiring the title and body to be
written before the diff is presented for approval. An agent whose
review of another agent's PR consists of "looks good" is failing
discernment; you correct it by giving it review rubrics with
specific things to check (security, schema regression, backward compat,
observability). An agent that ships without running the existing test
suite fails diligence; you correct it by withholding merge until CI
goes green.

This is, structurally, the same correction loop you run with a human
junior engineer. The difference is throughput. A human gets maybe ten
PRs of corrective feedback before the lesson sticks. An agent can take
two hundred PRs of feedback in a week, because the loop is automated
and the agent does not get tired. That throughput is why "agentic
teaching" is an active discipline now and not just a thought experiment.

On sof.ai we treat each merged PR as a teaching artifact for the *next*
PR. Every reviewer's reasoning is stored, classified, and folded back
into the system prompt of the agent that wrote it. The next time that
agent makes the same delegation mistake, an earlier instance of itself
will already have flagged it in the prompt. That is teaching, applied
to a worker that does not forget.

## 5. The four moves are the curriculum

If I had to compress this paper into a single recommendation for
educators, it would be: the next time you assign your students a
software project, do not assign the project. Assign three pull requests
against the project. Grade the pull requests on delegation,
description, discernment, diligence — in that order — not on whether
the code "works."

Code that works without those four moves is brittle, unteachable, and
unsafe to give an agent that is going to extend it next week. Code
that has been through the four moves can be passed forward — to the
next student, the next agent, the next decade — and remain legible.

That is the difference between writing software and *teaching
software*. The pull request is how the second one happens at scale.
"""

# --- Revision history -----------------------------------------------------

REVISIONS: list[tuple[str, str, str, str]] = [
    (
        EIC_TYPE,
        EIC_ID,
        "Initial submission for peer review.",
        BODY_V1,
    ),
]


def _founding_article(session: Session) -> JournalArticle | None:
    j = session.exec(select(Journal).where(Journal.slug == JOURNAL_SLUG)).first()
    if not j:
        return None
    return session.exec(
        select(JournalArticle).where(
            JournalArticle.journal_slug == JOURNAL_SLUG,
            JournalArticle.title == ARTICLE_TITLE,
        )
    ).first()


def _ensure_journal(session: Session) -> bool:
    j = session.exec(select(Journal).where(Journal.slug == JOURNAL_SLUG)).first()
    if j:
        return False
    session.add(
        Journal(
            slug=JOURNAL_SLUG,
            title="Agentic Teaching",
            description=(
                "A peer-reviewed journal for verified teaching experts who "
                "understand software design or computing. Authors take their "
                "teaching practice and use it to introduce coding principles "
                "— for humans and the agents we trust to ship. Submissions "
                "are encouraged to start from a public URL: paste the link, "
                "and sof.ai will use it as inspiration for an original, "
                "better article anchored in your pedagogy."
            ),
            topic_tags=(
                "teaching,pedagogy,software-engineering,ai-native,"
                "computing-education,agentic-teaching"
            ),
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
    existing = _founding_article(session)
    if existing:
        return existing, False
    article = JournalArticle(
        journal_slug=JOURNAL_SLUG,
        title=ARTICLE_TITLE,
        abstract=ABSTRACT,
        body=REVISIONS[-1][3],
        submitter_type=EIC_TYPE,
        submitter_id=EIC_ID,
        coauthors="agent:devin",
        status="published",
        source_url=SOURCE_URL,
        # Match the invariant every other publish path enforces (see
        # routes/articles.py and seed_journal_ai.py): a ``published``
        # article ALWAYS has a non-null ``published_at`` so OJS
        # federation and any future date-based filtering see a
        # consistent timestamp. Without this the article would round-trip
        # as ``{"status": "published", "published_at": null}``.
        published_at=datetime.now(UTC),
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
    existing = session.exec(
        select(JournalArticleRevision).where(
            JournalArticleRevision.article_id == article.id
        )
    ).all()
    seen = {r.revision_no for r in existing}
    created = 0
    for i, (rev_type, rev_id, changelog, body) in enumerate(REVISIONS, start=1):
        if i in seen:
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


def seed(session: Session) -> dict:
    """Bootstrap Agentic Teaching · Volume 1 Issue 1.

    Idempotent — every component is guarded with an existence check.
    Returns a small dict for log lines so the caller can verify what
    actually got created on a given startup.
    """
    journal_created = _ensure_journal(session)
    article, article_created = _ensure_article(session)
    rev_count = _ensure_revisions(session, article)
    session.commit()
    return {
        "journal_created": journal_created,
        "article_created": article_created,
        "revisions_created": rev_count,
    }
