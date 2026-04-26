/**
 * /api/embed/{slug}/mentor-notes
 *
 * GET   — trainer-console list of all proposed/applied/rejected notes.
 *         NextAuth-gated to the agent's viewer allowlist.
 * POST  — propose a new mentor note + kick off the Claude/Devin/Gemini
 *         review chain. Same auth gate. The review runs in-band on the
 *         POST request (~10–20s) so the trainer console can render the
 *         finalized state on the very next page render — no polling
 *         contract for v1.
 *
 * The trainer co-work feature treats the review chain as a safety
 * net, not an editorial step: trainers' literal proposed text is
 * what ships to the live system prompt when all three reviewers
 * approve. This keeps the trainer in full editorial control and
 * makes "Blajon proposes → Devin auto-applies" the design Dr.
 * Cheteni signed off on.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { canViewAgent } from "@/lib/embed/conversations";
import { runMentorNoteReviewChain } from "@/lib/embed/mentorNoteReview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The review chain calls Anthropic 2x + Gemini 1x in sequence. Vercel's
// 10s default would 504 mid-chain on a slow Anthropic response. 60s is
// well within Vercel Pro's 300s ceiling and matches the article
// pipeline's run-pipeline route.
export const maxDuration = 60;

function internalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  return headers;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!canViewAgent(slug, email)) {
    return NextResponse.json(
      { error: "Not authorized to view this agent's mentor notes." },
      { status: 403 },
    );
  }

  const incoming = new URL(req.url);
  const target = new URL(`${getApiBaseUrl()}/embed/${slug}/mentor-notes`);
  for (const key of ["limit", "offset", "status"]) {
    const v = incoming.searchParams.get(key);
    if (v !== null) target.searchParams.set(key, v);
  }
  const res = await fetch(target.toString(), {
    headers: internalHeaders(),
    cache: "no-store",
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

interface ProposeBody {
  proposed_text?: string;
  source_insight_id?: number | null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!canViewAgent(slug, email)) {
    return NextResponse.json(
      { error: "Not authorized to propose mentor notes for this agent." },
      { status: 403 },
    );
  }

  let body: ProposeBody;
  try {
    body = (await req.json()) as ProposeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const text = (body.proposed_text ?? "").trim();
  if (!text) {
    return NextResponse.json(
      { error: "proposed_text is required." },
      { status: 400 },
    );
  }
  if (text.length > 2000) {
    return NextResponse.json(
      { error: "proposed_text must be ≤2000 characters." },
      { status: 400 },
    );
  }

  // Step 1: create the pending row so the trainer console shows it
  // even if the review chain fails halfway.
  const proposeRes = await fetch(
    `${getApiBaseUrl()}/embed/${slug}/mentor-notes`,
    {
      method: "POST",
      headers: internalHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        proposed_by_email: email,
        proposed_text: text,
        source_insight_id: body.source_insight_id ?? null,
      }),
    },
  );
  if (!proposeRes.ok) {
    return new NextResponse(await proposeRes.text(), {
      status: proposeRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const created = (await proposeRes.json()) as { id: number };

  // Step 2: run the review chain. Errors here leave the row in
  // ``reviewing`` status — the trainer can re-trigger from the UI
  // (a future enhancement; v1 just shows the partial chain).
  const outcome = await runMentorNoteReviewChain(created.id, text);

  // Step 3: re-fetch the now-finalized row and return it. The chain
  // mutates state on the FastAPI side; the trainer's UI only needs
  // the final object to render verdict pills + applied text.
  const finalRes = await fetch(
    `${getApiBaseUrl()}/embed/${slug}/mentor-notes?limit=1`,
    {
      headers: internalHeaders(),
      cache: "no-store",
    },
  );
  let finalNote: unknown = created;
  if (finalRes.ok) {
    const list = (await finalRes.json()) as {
      items?: Array<{ id: number }>;
    };
    finalNote = list.items?.find((i) => i.id === created.id) ?? created;
  }
  return NextResponse.json({ note: finalNote, outcome }, { status: 201 });
}
