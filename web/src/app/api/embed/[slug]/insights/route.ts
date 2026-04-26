/**
 * /api/embed/{slug}/insights — list of classified insights for a given
 * embedded agent (LuxAI1, etc.).
 *
 * Auth: NextAuth session must be in the agent's viewer allowlist
 * (owner + lead professors). Mirrors the gating on
 * /api/embed/{slug}/conversations — same audience, same trust model.
 *
 * The page at /embed/{slug}/insights is the primary consumer; this
 * exists for client-side refresh and future external integrations.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { canViewAgent } from "@/lib/embed/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      { error: "Not authorized to view this agent's insights." },
      { status: 403 },
    );
  }

  const incoming = new URL(req.url);
  const target = new URL(`${getApiBaseUrl()}/embed/${slug}/insights`);
  for (const key of ["limit", "offset", "insight_type"]) {
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
