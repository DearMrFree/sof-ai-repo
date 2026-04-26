/**
 * /api/admin/recent
 *
 * GET — server-proxied feed of the most recent UserProfile rows. Used
 * by the admin dashboard for the initial state on first paint, before
 * the live SSE stream takes over. Adds the internal-auth header
 * server-side so the secret never reaches the client.
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
  if (!(await isAdmin(email))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const limit = req.nextUrl.searchParams.get("limit") ?? "20";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${getApiBaseUrl()}/users/admin/recent?limit=${encodeURIComponent(limit)}`,
      { headers, cache: "no-store" },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "upstream unreachable", detail: String(err) },
      { status: 502 },
    );
  }
  const text = await upstream.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return NextResponse.json(json, { status: upstream.status });
}
