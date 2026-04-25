/**
 * Vercel Cron: daily 30-day renewal sweep.
 *
 * Vercel hits this route GET on the schedule defined in `vercel.json`
 * (see `crons` block). We forward to the FastAPI cron endpoint with
 * the internal-auth header so the actual logic stays in one place.
 *
 * Security: Vercel Cron requests carry `Authorization: Bearer ${CRON_SECRET}`
 * so we can distinguish a real cron call from a random hit on the
 * public URL. If `CRON_SECRET` is set we enforce it; if it's missing
 * we still require the route be called either by the cron or by a
 * holder of the internal-auth key, never by an anonymous user.
 *
 * Phase 2c — Auto-renew accumulates impact-driven member transitions:
 *   conditionally_accepted (>=30 days old) →
 *     impact >= threshold      → member
 *     impact in gray zone      → escalated  (re-trio call)
 *     impact below gray floor  → expired
 */
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  // Internal-auth fallback for manual ops triggers
  const internal = process.env.INTERNAL_API_KEY;
  if (internal && req.headers.get("x-internal-auth") === internal) return true;
  return false;
}

async function runCron(): Promise<NextResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  const upstream = await fetch(
    `${getApiBaseUrl()}/applications/cron/auto-renew`,
    {
      method: "POST",
      headers,
      cache: "no-store",
    },
  );
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runCron();
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runCron();
}
