/**
 * /api/twins/{handle}/skills/{id}/retract
 *
 * POST — owner retracts an applied or pending skill. Owner verified
 * server-side; FastAPI also enforces the gate independently so this
 * is defense-in-depth.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { fetchOwnerEmail } from "@/lib/twin/api";

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
  ctx: { params: Promise<{ handle: string; id: string }> },
) {
  const { handle, id } = await ctx.params;
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Sign in to retract." },
      { status: 401 },
    );
  }
  const ownerEmail = await fetchOwnerEmail(handle);
  if (!ownerEmail || ownerEmail !== email) {
    return NextResponse.json(
      { error: "Only the profile owner can retract this skill." },
      { status: 403 },
    );
  }
  const skillId = Number(id);
  if (!Number.isFinite(skillId)) {
    return NextResponse.json({ error: "Invalid skill id." }, { status: 400 });
  }

  const res = await fetch(
    `${getApiBaseUrl()}/twins/skills/${skillId}/retract`,
    {
      method: "POST",
      headers: internalHeaders(),
      cache: "no-store",
      body: JSON.stringify({ proposed_by_email: email }),
    },
  );
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
