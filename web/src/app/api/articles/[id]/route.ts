/**
 * Proxy: GET /api/articles/{id} → FastAPI /articles/{id}
 *
 * Returns the article detail + multi-agent review rounds. Public; no
 * auth required (the article body is meant to be discoverable).
 */
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: { id: string } },
) {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "article id must be a positive integer." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/articles/${id}`, {
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
