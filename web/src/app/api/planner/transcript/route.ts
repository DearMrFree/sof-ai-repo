/** Proxy: /api/planner/transcript → FastAPI /planner/transcript */
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.search;
  const res = await fetch(`${getApiBaseUrl()}/planner/transcript${qs}`, {
    cache: "no-store",
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
