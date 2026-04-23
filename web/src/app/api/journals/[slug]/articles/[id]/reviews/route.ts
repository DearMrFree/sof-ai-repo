/**
 * Proxy: GET/POST /api/journals/[slug]/articles/[id]/reviews
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECOMMENDATIONS = new Set([
  "accept",
  "minor_revisions",
  "major_revisions",
  "reject",
]);

function internalHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const key = process.env.INTERNAL_API_KEY;
  if (key) h["X-Internal-Auth"] = key;
  return h;
}

export async function GET(
  _req: Request,
  { params }: { params: { slug: string; id: string } },
) {
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/journals/${encodeURIComponent(
        params.slug,
      )}/articles/${encodeURIComponent(params.id)}/reviews`,
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

export async function POST(
  req: Request,
  { params }: { params: { slug: string; id: string } },
) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string } | undefined;
  if (!sessionUser?.id) {
    return NextResponse.json(
      { error: "Sign in to submit a review." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const p = payload as { recommendation?: unknown; comments?: unknown };
  const recommendation =
    typeof p.recommendation === "string" ? p.recommendation : "";
  const comments =
    typeof p.comments === "string" ? p.comments.slice(0, 8000) : "";

  if (!RECOMMENDATIONS.has(recommendation)) {
    return NextResponse.json(
      {
        error:
          "recommendation must be accept | minor_revisions | major_revisions | reject.",
      },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `${getApiBaseUrl()}/journals/${encodeURIComponent(
        params.slug,
      )}/articles/${encodeURIComponent(params.id)}/reviews`,
      {
        method: "POST",
        headers: internalHeaders(),
        body: JSON.stringify({
          recommendation,
          comments,
          reviewer_type: "user",
          reviewer_id: sessionUser.id,
        }),
        cache: "no-store",
      },
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
