import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as
    | { id?: string; name?: string | null; email?: string | null }
    | undefined;
  if (!sessionUser?.id) {
    return NextResponse.json(
      { error: "Sign in to pick up a challenge." },
      { status: 401 },
    );
  }

  const challengeId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(challengeId) || challengeId <= 0) {
    return NextResponse.json(
      { error: "Invalid challenge id." },
      { status: 400 },
    );
  }

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    // Body is optional — an empty claim with just the session user is fine.
  }
  const p = (payload ?? {}) as {
    claimer_type?: unknown;
    claimer_id?: unknown;
    pr_url?: unknown;
  };
  // Default the claimer to the signed-in human, but allow the client to
  // override (e.g. "claim on behalf of agent devin" from a /api/devin flow
  // that wants to mark the challenge as agent-claimed).
  const claimerType =
    p.claimer_type === "agent" || p.claimer_type === "user"
      ? p.claimer_type
      : "user";
  const claimerId =
    typeof p.claimer_id === "string" && p.claimer_id.trim()
      ? p.claimer_id.trim()
      : sessionUser.id;
  const prUrl =
    typeof p.pr_url === "string" && p.pr_url.trim() ? p.pr_url.trim() : null;

  try {
    const res = await fetch(
      `${getApiBaseUrl()}/challenges/${challengeId}/claim`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimer_type: claimerType,
          claimer_id: claimerId,
          pr_url: prUrl,
        }),
        cache: "no-store",
      },
    );
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Couldn't reach the challenges backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
}
