/**
 * Living-Article review-chain orchestration (PR #11 logic).
 *
 * Walks an article through the canonical review chain:
 *
 *   claude_review_1 → devin_review_1 → claude_review_2
 *                  → gemini_review   → devin_final
 *
 * Each phase calls the appropriate model (Claude/Anthropic for Claude
 * phases; Anthropic for Devin phases since Claude is Devin's reasoning
 * model in this codebase; Google Gemini's REST API for the Gemini phase
 * with an Anthropic fallback if GEMINI_API_KEY isn't set), records the
 * structured output as an ArticleReviewRound on the FastAPI side, and
 * advances ``pipeline_phase`` to the next stage.
 *
 * Idempotent — if the article is already at or past a phase, that phase
 * is skipped. After all five review phases, the article lands at
 * ``awaiting_approval`` for Dr. Cheteni's sign-off.
 *
 * Distribution to X / LinkedIn / Substack / Medium happens in a separate
 * publish step (PR #12); this module's responsibility ends at
 * ``awaiting_approval``.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getApiBaseUrl } from "@/lib/apiBase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelinePhase =
  | "drafted"
  | "claude_review_1"
  | "devin_review_1"
  | "claude_review_2"
  | "gemini_review"
  | "devin_final"
  | "awaiting_approval"
  | "approved"
  | "published";

export const REVIEW_PHASES = [
  "claude_review_1",
  "devin_review_1",
  "claude_review_2",
  "gemini_review",
  "devin_final",
] as const;

export type ReviewPhase = (typeof REVIEW_PHASES)[number];

export interface ArticleAuthor {
  type: "user" | "agent";
  id: string;
  display_name: string;
}

export interface ArticleSnapshot {
  id: number;
  title: string;
  abstract: string;
  body: string;
  primary_author: ArticleAuthor;
  coauthors: ArticleAuthor[];
  pipeline_phase: PipelinePhase;
}

export interface PhaseResult {
  phase: PipelinePhase;
  reviewer_id: string;
  summary: string;
  body: string;
  ran: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Prompts — each phase has a focused system prompt that enforces the
// reviewer's role + a JSON-shaped reply contract. Real peer-review
// quality matters because every published article informs how sof.ai is
// built next, per Dr. Cheteni: "the articles will impact our build."
// ---------------------------------------------------------------------------

interface PhasePrompt {
  reviewer_id: "claude" | "devin" | "gemini";
  system: string;
  /** A user message template; the article title/body/abstract are
   * interpolated when the prompt fires. */
  template: (a: ArticleSnapshot) => string;
}

const PROMPTS: Record<ReviewPhase, PhasePrompt> = {
  claude_review_1: {
    reviewer_id: "claude",
    system:
      "You are Claude, serving as the round-1 peer reviewer on a sof.ai " +
      "Living Article. Your role is aesthetics + accuracy + literature-review " +
      "framing. Tighten the prose, fix factual errors, suggest 2-4 citations " +
      "to ground the claims, propose a stronger title if warranted, and " +
      "rewrite the abstract for clarity. The article will impact how the " +
      "sof.ai system is built — its rigor matters. Be honest, not flattering.",
    template: (a) =>
      `Article ID: ${a.id}\nCurrent title: ${a.title}\n\nAbstract:\n${
        a.abstract
      }\n\nBody:\n${a.body.slice(
        0,
        12000,
      )}\n\nReply in two parts:\n  SUMMARY: one paragraph (≤80 words) capturing the most important changes you'd make.\n  BODY: the detailed review (markdown).`,
  },

  devin_review_1: {
    reviewer_id: "devin",
    system:
      "You are Devin, serving as the round-2 reviewer on a sof.ai Living " +
      "Article. Your role is technical correctness — audit any code blocks " +
      "for compilable shape, dependency hygiene, and security implications. " +
      "Flag any architectural assumptions that would bite a real implementer. " +
      "If the article is non-technical, focus on whether the engineering " +
      "implications it asserts are well-founded. The article will inform how " +
      "sof.ai itself is built, so your review must be the kind you'd want " +
      "applied to your own PRs. Be terse, surgical, useful.",
    template: (a) =>
      `Article ID: ${a.id}\nTitle: ${a.title}\n\nBody:\n${a.body.slice(
        0,
        12000,
      )}\n\nReply in two parts:\n  SUMMARY: one paragraph (≤80 words) of the highest-impact technical findings.\n  BODY: detailed review (markdown), code blocks where needed.`,
  },

  claude_review_2: {
    reviewer_id: "claude",
    system:
      "You are Claude, serving as the round-3 reviewer. Round 1 surfaced " +
      "stylistic and lit-review concerns; round 2 (Devin) surfaced technical " +
      "concerns. Your job now is final-polish: make sure the prose is tight, " +
      "the structure is engaging, the contribution is clear in the first 3 " +
      "sentences, and the call to action is concrete. Suggest at most 3 " +
      "high-leverage edits that will make this readable and citable, not 30 " +
      "small ones. This article will inform sof.ai's build — every claim " +
      "must be defensible.",
    template: (a) =>
      `Article ID: ${a.id}\nTitle: ${a.title}\n\nAbstract:\n${
        a.abstract
      }\n\nBody:\n${a.body.slice(
        0,
        12000,
      )}\n\nReply in two parts:\n  SUMMARY: one paragraph (≤60 words) — what's the single most impactful polish you'd ship?\n  BODY: detailed review (markdown).`,
  },

  gemini_review: {
    reviewer_id: "gemini",
    system:
      "You are Gemini, serving as the round-4 reviewer. Your role is " +
      "amplification: propose 3 alt headlines (each ≤80 chars), 2 hero-image " +
      "prompts (concrete + visual), and an honest 0-10 virality score with " +
      "reasoning. Do NOT invent facts; you're here to make a finished article " +
      "more discoverable, not to alter its claims.",
    template: (a) =>
      `Article ID: ${a.id}\nTitle: ${a.title}\n\nAbstract:\n${
        a.abstract
      }\n\nBody:\n${a.body.slice(
        0,
        8000,
      )}\n\nReply in two parts:\n  SUMMARY: one short paragraph with your virality score (0-10) and the strongest headline.\n  BODY: full markdown with the headline list, image prompts, and reasoning.`,
  },

  devin_final: {
    reviewer_id: "devin",
    system:
      "You are Devin, serving as the round-5 final reviewer on a sof.ai " +
      "Living Article. Read all prior reviews. Your job is to decide whether " +
      "the article is ready for Dr. Freedom Cheteni's approval. State " +
      "explicitly whether the prior reviewers' edits have been applied " +
      "(yes / partially / no), summarize the journey from draft to here, and " +
      "produce a one-paragraph editor's note Dr. Cheteni will read first.",
    template: (a) =>
      `Article ID: ${a.id}\nTitle: ${a.title}\n\nBody:\n${a.body.slice(
        0,
        12000,
      )}\n\nReply in two parts:\n  SUMMARY: one paragraph (≤80 words) editor's note for Dr. Cheteni.\n  BODY: full assessment (markdown), explicitly noting what changed since the draft.`,
  },
};

// ---------------------------------------------------------------------------
// Output parsing — every reviewer is told to reply in a SUMMARY/BODY
// shape so we can split the response cleanly. Fallback: if no SUMMARY
// header is found we use the first paragraph as the summary.
// ---------------------------------------------------------------------------

interface ReviewSplit {
  summary: string;
  body: string;
}

export function splitReview(text: string): ReviewSplit {
  const cleaned = text.trim();
  const summaryMatch = cleaned.match(/SUMMARY:\s*([\s\S]*?)(?:\n\s*BODY:|$)/i);
  const bodyMatch = cleaned.match(/BODY:\s*([\s\S]*)$/i);

  if (summaryMatch && bodyMatch) {
    return {
      summary: summaryMatch[1].trim().slice(0, 500),
      body: bodyMatch[1].trim(),
    };
  }

  const firstPara = cleaned.split(/\n\s*\n/)[0] ?? cleaned;
  return {
    summary: firstPara.slice(0, 500),
    body: cleaned,
  };
}

// ---------------------------------------------------------------------------
// Anthropic + Gemini call helpers
// ---------------------------------------------------------------------------

async function runAnthropicReview(
  system: string,
  userMessage: string,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured; review chain cannot run.",
    );
  }
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const text = resp.content
    .filter((p): p is Anthropic.TextBlock => p.type === "text")
    .map((p) => p.text)
    .join("\n\n")
    .trim();
  if (!text) throw new Error("Empty response from Anthropic.");
  return text;
}

async function runGeminiReview(
  system: string,
  userMessage: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fallback: use Anthropic with a Gemini-flavored system prompt so
    // the pipeline still produces a virality / visuals review.
    return runAnthropicReview(
      system + "\n\n(Note: you are simulating Gemini for this review.)",
      userMessage,
    );
  }
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    "gemini-1.5-pro-latest:generateContent?key=" +
    encodeURIComponent(apiKey);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [
        { role: "user", parts: [{ text: userMessage }] },
      ],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("\n\n")
    .trim();
  if (!text) throw new Error("Empty response from Gemini.");
  return text;
}

// ---------------------------------------------------------------------------
// Phase runner — runs the appropriate model, splits the response, and
// posts an /advance call to FastAPI which records the round + moves to
// the next phase.
// ---------------------------------------------------------------------------

function internalHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    h["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  return h;
}

async function fetchArticle(articleId: number): Promise<ArticleSnapshot> {
  const res = await fetch(`${getApiBaseUrl()}/articles/${articleId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`fetchArticle: HTTP ${res.status}`);
  }
  return (await res.json()) as ArticleSnapshot;
}

async function advancePhase(
  articleId: number,
  summary: string,
  body: string,
  actorUserId: string,
): Promise<void> {
  const res = await fetch(
    `${getApiBaseUrl()}/articles/${articleId}/advance`,
    {
      method: "POST",
      headers: internalHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        actor_user_id: actorUserId,
        summary,
        body,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `advancePhase: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`,
    );
  }
}

async function runPhase(
  article: ArticleSnapshot,
  phase: (typeof REVIEW_PHASES)[number],
  actorUserId: string,
): Promise<PhaseResult> {
  const prompt = PROMPTS[phase];
  try {
    const userMessage = prompt.template(article);
    const text =
      prompt.reviewer_id === "gemini"
        ? await runGeminiReview(prompt.system, userMessage)
        : await runAnthropicReview(prompt.system, userMessage);
    const { summary, body } = splitReview(text);
    await advancePhase(article.id, summary, body, actorUserId);
    return {
      phase,
      reviewer_id: prompt.reviewer_id,
      summary,
      body,
      ran: true,
    };
  } catch (err) {
    return {
      phase,
      reviewer_id: prompt.reviewer_id,
      summary: "",
      body: "",
      ran: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Public entrypoint — walk the article through every remaining review
// phase. Idempotent: if the article is already past a phase we skip it.
// Stops at the first failure and returns; the caller can retry.
// ---------------------------------------------------------------------------

export async function runReviewChain(
  articleId: number,
  actorUserId: string,
): Promise<{
  startingPhase: PipelinePhase;
  endingPhase: PipelinePhase;
  results: PhaseResult[];
}> {
  let article = await fetchArticle(articleId);
  const startingPhase = article.pipeline_phase;
  const results: PhaseResult[] = [];

  // First, if the article is still in `drafted`, advance once to enter
  // the review chain. The drafted → claude_review_1 transition records
  // no review round (drafted isn't an agent phase).
  if (article.pipeline_phase === "drafted") {
    await advancePhase(article.id, "Pipeline started", "", actorUserId);
    article = await fetchArticle(articleId);
  }

  for (const phase of REVIEW_PHASES) {
    if (article.pipeline_phase !== phase) {
      // Already past this phase; skip.
      continue;
    }
    const result = await runPhase(article, phase, actorUserId);
    results.push(result);
    if (!result.ran) {
      // Stop; caller can retry. Return what we have so far.
      return {
        startingPhase,
        endingPhase: article.pipeline_phase,
        results,
      };
    }
    article = await fetchArticle(articleId);
  }

  return {
    startingPhase,
    endingPhase: article.pipeline_phase,
    results,
  };
}
