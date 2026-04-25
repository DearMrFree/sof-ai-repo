/**
 * Proxy: GET /api/articles → FastAPI /articles
 *
 * Public listing of Living-Article Pipeline articles. No auth required —
 * articles in the pipeline are visible to logged-out visitors so the
 * "School of AI is collaborative" narrative shows up in SEO.
 */
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/articles`, {
      cache: "no-store",
    });
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
          "Couldn't reach the articles backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
}
