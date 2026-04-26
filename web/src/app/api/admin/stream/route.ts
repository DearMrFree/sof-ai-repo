/**
 * /api/admin/stream
 *
 * GET — Proxy a Server-Sent Events stream from FastAPI's
 * `/users/admin/stream` to the browser. The proxy adds the internal
 * auth token as `?auth=` (browsers can't set headers on EventSource)
 * so the secret never reaches the client. NextAuth-gated to admins.
 *
 * The route forwards both the upstream body and the `text/event-stream`
 * content-type. Disconnects from the client cancel the upstream fetch
 * via the request's AbortSignal so we don't leak open connections.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  // Server-side admin check: re-fetch the user's profile from FastAPI
  // (the source of truth) instead of trusting client-supplied state.
  const allowed = await isAdmin(email);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const auth = process.env.INTERNAL_API_KEY ?? "";
  const url = `${getApiBaseUrl()}/users/admin/stream${
    auth ? `?auth=${encodeURIComponent(auth)}` : ""
  }`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      // Forward the client's disconnect signal upstream.
      signal: req.signal,
      cache: "no-store",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "upstream unreachable", detail: String(err) },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "upstream error", status: upstream.status },
      { status: 502 },
    );
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
