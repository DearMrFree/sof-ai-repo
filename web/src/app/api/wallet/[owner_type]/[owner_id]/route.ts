/**
 * Proxy: GET /api/wallet/{owner_type}/{owner_id} → FastAPI /wallet/...
 *
 * Read-only, no auth required. Anyone can see any wallet's public
 * balance — sof.ai's economy is transparent by design, like a
 * visible-ledger cryptocurrency. Private details (earn rules trigger
 * data, capstone PR URLs, etc.) live elsewhere.
 */
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["user", "agent"]);

export async function GET(
  _req: Request,
  { params }: { params: { owner_type: string; owner_id: string } },
) {
  if (!ALLOWED_TYPES.has(params.owner_type)) {
    return NextResponse.json(
      { error: "owner_type must be 'user' or 'agent'." },
      { status: 400 },
    );
  }
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/wallet/${encodeURIComponent(
        params.owner_type,
      )}/${encodeURIComponent(params.owner_id)}`,
      { cache: "no-store" },
    );
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
