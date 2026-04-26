/**
 * /api/twins/{handle}/skills
 *
 * GET   — public read: every non-retracted skill for the twin. Pure
 *         proxy to FastAPI; no session needed (mirrors the public
 *         /u/{handle} read shape).
 * POST  — owner-only: propose a new skill + run the Claude/Devin/Gemini
 *         review chain in-band. Owner is verified server-side by
 *         comparing the NextAuth session email to the profile's email
 *         on FastAPI; client cannot forge.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { fetchOwnerEmail, fetchTwinSummary } from "@/lib/twin/api";
import { runTwinSkillReviewChain } from "@/lib/twin/skillReview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function internalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  return headers;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ handle: string }> },
) {
  const { handle } = await ctx.params;
  const res = await fetch(
    `${getApiBaseUrl()}/twins/by-handle/${encodeURIComponent(
      handle.toLowerCase(),
    )}/skills`,
    { headers: internalHeaders(), cache: "no-store" },
  );
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

interface ProposeBody {
  title?: string;
  proposed_text?: string;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ handle: string }> },
) {
  const { handle } = await ctx.params;
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Sign in to train your twin." },
      { status: 401 },
    );
  }
  const ownerEmail = await fetchOwnerEmail(handle);
  if (!ownerEmail) {
    return NextResponse.json(
      { error: "Profile not found." },
      { status: 404 },
    );
  }
  if (ownerEmail !== email) {
    return NextResponse.json(
      { error: "Only the profile owner can train this twin." },
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
  const title = (body.title ?? "").trim();
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

  // Fetch the twin's seed brand so the review chain can judge the
  // skill against this specific persona, not a generic agent.
  const summary = await fetchTwinSummary(handle);
  if (!summary) {
    return NextResponse.json(
      { error: "Twin summary unavailable; try again." },
      { status: 502 },
    );
  }

  const proposeRes = await fetch(
    `${getApiBaseUrl()}/twins/by-handle/${encodeURIComponent(
      handle.toLowerCase(),
    )}/skills`,
    {
      method: "POST",
      headers: internalHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        proposed_by_email: email,
        title,
        proposed_text: text,
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

  const outcome = await runTwinSkillReviewChain(created.id, text, {
    display_name: summary.display_name,
    user_type: summary.user_type,
    twin_name: summary.twin_name,
    twin_emoji: summary.twin_emoji,
    twin_persona_seed: summary.twin_persona_seed,
    first_project: summary.first_project,
  });

  // Re-fetch the now-finalized row by listing the latest 1 + filtering by id.
  const finalRes = await fetch(
    `${getApiBaseUrl()}/twins/by-handle/${encodeURIComponent(
      handle.toLowerCase(),
    )}/skills`,
    { headers: internalHeaders(), cache: "no-store" },
  );
  if (!finalRes.ok) {
    return NextResponse.json({
      id: created.id,
      finalized_status: outcome.finalized_status,
      error: outcome.error,
    });
  }
  const list = (await finalRes.json()) as {
    items: { id: number }[];
  };
  const final = list.items.find((x) => x.id === created.id) ?? null;
  return NextResponse.json({
    skill: final,
    finalized_status: outcome.finalized_status,
    error: outcome.error,
  });
}
