import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string; id: string } },
) {
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/journals/${encodeURIComponent(
        params.slug,
      )}/articles/${encodeURIComponent(params.id)}`,
      { cache: "no-store" },
    );
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Upstream error: " + (err instanceof Error ? err.message : "") },
      { status: 502 },
    );
  }
}
