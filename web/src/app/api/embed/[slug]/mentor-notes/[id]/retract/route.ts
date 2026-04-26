/**
 * /api/embed/{slug}/mentor-notes/{id}/retract — pull an applied note
 * back out of the live system prompt.
 *
 * Distinct from rejection: rejection means the chain blocked it from
 * shipping; retraction means it shipped, the trainer learned
 * something (a customer complained, a guardrail was missed in
 * review, the note collided with a later capability), and is now
 * pulling it back. Once retracted, the row stays in the trainer
 * console for audit but no longer flows into the system prompt.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { canViewAgent } from "@/lib/embed/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function internalHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    h["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  return h;
}

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!canViewAgent(slug, email)) {
    return NextResponse.json(
      { error: "Not authorized to retract mentor notes for this agent." },
      { status: 403 },
    );
  }

  const numericId = Number.parseInt(id, 10);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "Invalid note id." }, { status: 400 });
  }

  const res = await fetch(
    `${getApiBaseUrl()}/embed/mentor-notes/${numericId}/retract`,
    {
      method: "POST",
      headers: internalHeaders(),
      cache: "no-store",
    },
  );
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
