/** Proxy: /api/catalog/levels → FastAPI /catalog/levels */
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const res = await fetch(`${getApiBaseUrl()}/catalog/levels`, {
    cache: "no-store",
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
