/**
 * POST /api/grade-exercise
 *
 * AI-graded coding exercise. Given a problem statement + rubric + the
 * student's submission (and, optionally, a staff reference solution), the
 * LLM returns a strict JSON rubric `{ score, feedback, passed }`.
 *
 * The LLM is *not* executing the student's code — it is reasoning about it.
 * A real sandboxed execution layer (Judge0 / Firecracker / nsjail) is
 * deferred to Phase B, because shipping an "exec arbitrary student code"
 * path is a safety-critical infra choice, not a prompt change.
 *
 * Earn hooks (Educoin®):
 *   +20 EDU on `passed: true`  (correlation: "exercise:{slug}:{user}:pass")
 *   +5  EDU on any attempt     (correlation: "exercise:{slug}:{user}:attempt")
 *   Both are deduped — a user retrying the same exercise only gets paid once.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { chatJSON } from "@/lib/llm";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GradeRequest {
  /** Stable identifier for the exercise (for dedup + correlation). */
  exerciseSlug: string;
  /** The problem the student is solving. */
  problem: string;
  /** The rubric the grader should apply (free-form text). */
  rubric: string;
  /** The student's submitted answer — usually code, sometimes prose. */
  submission: string;
  /** Optional staff reference solution to anchor the grading. */
  staffSolution?: string;
  /** Optional language hint for prose (defaults to english). */
  language?: string;
  /** Optional provider override: "anthropic" | "deepseek". */
  provider?: "anthropic" | "deepseek";
}

interface RubricResponse {
  score: number;
  feedback: string;
  passed: boolean;
}

function ok(value: unknown): value is RubricResponse {
  const v = value as Partial<RubricResponse> | null;
  if (!v || typeof v !== "object") return false;
  if (typeof v.score !== "number") return false;
  if (typeof v.feedback !== "string") return false;
  if (typeof v.passed !== "boolean") return false;
  return true;
}

export async function POST(req: NextRequest) {
  // Gate billable LLM calls behind auth so scripts can't burn the API budget.
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: "Sign in to submit exercises." },
      { status: 401 },
    );
  }

  let body: GradeRequest;
  try {
    body = (await req.json()) as GradeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.exerciseSlug?.trim()) {
    return NextResponse.json(
      { error: "exerciseSlug is required." },
      { status: 400 },
    );
  }
  if (!body.submission?.trim()) {
    return NextResponse.json(
      { error: "Your submission is empty." },
      { status: 400 },
    );
  }
  if (!body.problem?.trim() || !body.rubric?.trim()) {
    return NextResponse.json(
      { error: "problem and rubric are required." },
      { status: 400 },
    );
  }

  // Build the structured grading prompt. Deliberately terse — DeepSeek and
  // Claude both respect JSON-only instructions better with short, direct
  // framing than with verbose templates.
  const system = [
    "You are a strict but kind AI grader for the sof.ai LMS.",
    "Evaluate the student's submission against the problem statement and",
    "rubric. Consider correctness, completeness, efficiency, and clarity.",
    "Score 0-100. 'passed' is true iff score >= 70 AND the submission",
    "meets the core rubric requirements.",
    "Keep feedback under 150 words, actionable, and encouraging.",
    "Output schema: { \"score\": number, \"feedback\": string, \"passed\": boolean }",
  ].join(" ");

  const userPrompt = [
    `## Problem\n${body.problem.trim()}`,
    `## Rubric\n${body.rubric.trim()}`,
    body.staffSolution
      ? `## Staff reference solution\n${body.staffSolution.trim()}`
      : null,
    `## Student submission\n${body.submission.trim()}`,
    `Now produce the JSON rubric.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let result;
  try {
    result = await chatJSON<RubricResponse>({
      provider: body.provider,
      system,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 800,
      temperature: 0.1,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Grader unavailable: ${msg}` },
      { status: 503 },
    );
  }

  if (!ok(result.data)) {
    return NextResponse.json(
      {
        error: "Grader returned malformed JSON.",
        raw: result.raw,
      },
      { status: 502 },
    );
  }

  // Clamp score into [0, 100] — some models drift.
  const rubric: RubricResponse = {
    score: Math.max(0, Math.min(100, Math.round(result.data.score))),
    feedback: result.data.feedback,
    passed: !!result.data.passed,
  };

  // Fire-and-forget Educoin® credit — never block the response on the
  // backend being up. The ledger dedupes on correlation_id so retries are
  // cheap no-ops.
  const userId = (session.user as { id?: string }).id;
  const accountId = userId ?? session.user.email ?? "anon";
  void creditEarn({
    ownerType: "user",
    ownerId: accountId,
    rule: "exercise_attempted",
    correlationId: `exercise:${body.exerciseSlug}:${accountId}:attempt`,
  });
  if (rubric.passed) {
    void creditEarn({
      ownerType: "user",
      ownerId: accountId,
      rule: "exercise_passed",
      correlationId: `exercise:${body.exerciseSlug}:${accountId}:pass`,
    });
  }

  return NextResponse.json({
    ...rubric,
    provider: result.provider,
    model: result.model,
  });
}

async function creditEarn(args: {
  ownerType: "user" | "agent";
  ownerId: string;
  rule: string;
  correlationId: string;
}) {
  const base = getApiBaseUrl();
  if (!base) return;
  const internal = process.env.INTERNAL_API_KEY;
  try {
    await fetch(`${base}/wallet/earn`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(internal ? { "X-Internal-Auth": internal } : {}),
      },
      body: JSON.stringify({
        owner_type: args.ownerType,
        owner_id: args.ownerId,
        rule: args.rule,
        correlation_id: args.correlationId,
      }),
    });
  } catch {
    // Non-fatal — the grade response has already shipped.
  }
}
