/**
 * Proxy: GET /api/journals/ojs-status → FastAPI /journals/_ojs/status
 *
 * Read-only; used by the Journals directory page to render a "Federated
 * with OJS" badge when the backend has an OJS_BASE_URL + OJS_API_TOKEN
 * configured. No auth required — this only exposes a boolean flag.
 */
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/journals/_ojs/status`, {
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch {
    // Backend down — treat as "federation off" rather than surfacing a 5xx.
    return NextResponse.json({ enabled: false }, { status: 200 });
  }
}
