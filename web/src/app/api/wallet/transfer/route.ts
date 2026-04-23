/**
 * Proxy: POST /api/wallet/transfer → FastAPI /wallet/transfer
 *
 * Auth-gated. We ALWAYS override sender_id with the authenticated
 * session user's id, so a malicious client can't transfer from
 * someone else's wallet by sending a spoofed sender_id. Agents
 * currently can't initiate transfers through this endpoint — those
 * happen server-side via an admin/agent-driven job (future work).
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["user", "agent"]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string } | undefined;
  if (!sessionUser?.id) {
    return NextResponse.json(
      { error: "Sign in to send Educoins." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const p = payload as {
    recipient_type?: unknown;
    recipient_id?: unknown;
    amount?: unknown;
    memo?: unknown;
  };

  const recipientType =
    typeof p.recipient_type === "string" ? p.recipient_type : "";
  const recipientId = typeof p.recipient_id === "string" ? p.recipient_id : "";
  const amount = typeof p.amount === "number" ? Math.floor(p.amount) : 0;
  const memo = typeof p.memo === "string" ? p.memo.slice(0, 280) : "";

  if (!ALLOWED_TYPES.has(recipientType)) {
    return NextResponse.json(
      { error: "recipient_type must be 'user' or 'agent'." },
      { status: 400 },
    );
  }
  if (!recipientId || recipientId.length > 80) {
    return NextResponse.json({ error: "Invalid recipient." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    return NextResponse.json(
      { error: "Amount must be a positive integer ≤ 100,000." },
      { status: 400 },
    );
  }
  if (recipientType === "user" && recipientId === sessionUser.id) {
    return NextResponse.json(
      { error: "You can't send Educoins to yourself." },
      { status: 400 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Forward the shared secret that the FastAPI /wallet/transfer route
  // requires in production — this is what prevents direct calls to the
  // public Fly backend from spoofing `sender_id` on someone else's
  // wallet. Mirrors settings.internal_api_key on the API side.
  const internalKey = process.env.INTERNAL_API_KEY;
  if (internalKey) {
    headers["X-Internal-Auth"] = internalKey;
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/wallet/transfer`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sender_type: "user",
        sender_id: sessionUser.id,
        recipient_type: recipientType,
        recipient_id: recipientId,
        amount,
        memo,
      }),
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type":
          res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Couldn't reach the wallet backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
}
