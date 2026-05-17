/** Proxy: /api/catalog/sync → FastAPI /catalog/sync and /catalog/sync/status */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { APPROVER_EMAIL } from "@/lib/applications/trio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function internalHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    h["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  return h;
}

export async function GET() {
  const res = await fetch(`${getApiBaseUrl()}/catalog/sync/status`, {
    cache: "no-store",
    headers: internalHeaders(),
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = (session?.user as { email?: string })?.email ?? "";
  if (email !== APPROVER_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "2600";
  const res = await fetch(
    `${getApiBaseUrl()}/catalog/sync?limit=${encodeURIComponent(limit)}`,
    { method: "POST", headers: internalHeaders() },
  );
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
