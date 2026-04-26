/**
 * /api/embed/{slug}/conversations/{id} — full transcript for a single
 * conversation. Same gating as the list route.
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
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!canViewAgent(slug, email)) {
    return NextResponse.json(
      { error: "Not authorized to view this agent's conversations." },
      { status: 403 },
    );
  }

  const numeric = Number.parseInt(id, 10);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const res = await fetch(
    `${getApiBaseUrl()}/embed/conversations/${numeric}`,
    {
      headers: internalHeaders(),
      cache: "no-store",
    },
  );
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
