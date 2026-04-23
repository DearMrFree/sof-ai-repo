import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { owner_type: string; owner_id: string } },
) {
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "20";
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/wallet/${encodeURIComponent(
        params.owner_type,
      )}/${encodeURIComponent(
        params.owner_id,
      )}/transactions?limit=${encodeURIComponent(limit)}`,
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
