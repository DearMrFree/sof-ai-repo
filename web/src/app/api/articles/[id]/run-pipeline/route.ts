/**
 * POST /api/articles/{id}/run-pipeline
 *
 * Walks an article through the full Living-Article review chain:
 *
 *   claude_review_1 → devin_review_1 → claude_review_2
 *                  → gemini_review   → devin_final
 *
 * Each phase calls the relevant model (Claude via Anthropic, Devin via
 * Anthropic with a code-audit system prompt, Gemini via Google's REST
 * API with an Anthropic fallback), records the structured output as an
 * ArticleReviewRound, and advances pipeline_phase. After all five
 * review phases the article lands at `awaiting_approval` for Dr.
 * Cheteni's sign-off.
 *
 * Auth: Dr. Cheteni only. The orchestrator burns Anthropic + Gemini
 * tokens, so we gate it on the operator email rather than expose the
 * trigger to every signed-in user.
 *
 * Response shape:
 *   { startingPhase, endingPhase, results: PhaseResult[] }
 *
 * The route can take 30-90 seconds to complete (5 model calls). We set
 * `runtime = "nodejs"` and `dynamic = "force-dynamic"` so Vercel doesn't
 * try to cache the response.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runReviewChain } from "@/lib/articles/reviewChain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const APPROVER_EMAIL = "freedom@thevrschool.org";

export async function POST(
  _req: Request,
  ctx: { params: { id: string } },
) {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "article id must be a positive integer." },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as
    | { id?: string; email?: string }
    | undefined;
  const email = (sessionUser?.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Sign in to run the review pipeline." },
      { status: 401 },
    );
  }
  if (email !== APPROVER_EMAIL) {
    return NextResponse.json(
      {
        error:
          "Only Dr. Freedom Cheteni can drive the review pipeline manually.",
      },
      { status: 403 },
    );
  }

  try {
    const out = await runReviewChain(id, sessionUser?.id ?? email);
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Pipeline failed: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 },
    );
  }
}
