import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyCall } from "@/lib/cowork/auth";
import { runTool } from "@/lib/cowork/runners";
import { recordAudit } from "@/lib/cowork/audit";
import type { CoworkExecutionResult } from "@/lib/cowork/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function userIdOf(session: { user?: { id?: unknown; email?: string | null } } | null): string {
  const u = session?.user;
  if (!u) return "anon";
  if (typeof (u as { id?: unknown }).id === "string") {
    return (u as { id: string }).id;
  }
  return u.email ?? "anon";
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: "Sign in to execute cowork actions." },
      { status: 401 },
    );
  }

  let body: { callId?: string };
  try {
    body = (await req.json()) as { callId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.callId) {
    return NextResponse.json({ error: "Missing callId" }, { status: 400 });
  }

  let payload;
  try {
    payload = verifyCall(body.callId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bad token." },
      { status: 400 },
    );
  }

  const sessionUserId = userIdOf(session);
  if (payload.userId !== sessionUserId) {
    return NextResponse.json(
      { error: "Approval token does not belong to current session." },
      { status: 403 },
    );
  }

  const t0 = Date.now();
  let result: unknown;
  let ok = true;
  let error: string | undefined;
  try {
    result = await runTool(payload.toolId, payload.params);
  } catch (err) {
    ok = false;
    error = err instanceof Error ? err.message : "Unknown error";
  }
  const durationMs = Date.now() - t0;

  await recordAudit({
    ts: new Date().toISOString(),
    userId: sessionUserId,
    toolId: payload.toolId,
    params: payload.params,
    ok,
    error,
    durationMs,
  });

  const payloadOut: CoworkExecutionResult = ok
    ? { ok: true, toolId: payload.toolId, result, durationMs }
    : { ok: false, toolId: payload.toolId, error, durationMs };
  return NextResponse.json(payloadOut, { status: ok ? 200 : 502 });
}
