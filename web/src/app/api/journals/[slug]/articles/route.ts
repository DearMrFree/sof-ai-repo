/**
 * Proxy: GET/POST /api/journals/[slug]/articles → FastAPI
 *
 * POST auth-gates, overrides submitter_id from the session.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function internalHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const key = process.env.INTERNAL_API_KEY;
  if (key) h["X-Internal-Auth"] = key;
  return h;
}

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/journals/${encodeURIComponent(params.slug)}/articles`,
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
  { params }: { params: { slug: string } },
) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string } | undefined;
  if (!sessionUser?.id) {
    return NextResponse.json(
      { error: "Sign in to submit an article." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const p = payload as {
    title?: unknown;
    abstract?: unknown;
    body?: unknown;
    coauthors?: unknown;
    source_url?: unknown;
  };

  const title = typeof p.title === "string" ? p.title.trim() : "";
  const abstract =
    typeof p.abstract === "string" ? p.abstract.slice(0, 4000) : "";
  const body = typeof p.body === "string" ? p.body.slice(0, 200_000) : "";
  const coauthors = Array.isArray(p.coauthors)
    ? p.coauthors.filter((c): c is string => typeof c === "string").slice(0, 40)
    : [];
  // source_url is optional. We accept http(s) only and cap length to keep
  // FastAPI's max_length=2000 honored before the round-trip.
  let sourceUrl: string | null = null;
  if (typeof p.source_url === "string") {
    const trimmed = p.source_url.trim().slice(0, 2000);
    if (trimmed.length > 0) {
      if (!/^https?:\/\//i.test(trimmed)) {
        return NextResponse.json(
          { error: "Source URL must start with http:// or https://." },
          { status: 400 },
        );
      }
      sourceUrl = trimmed;
    }
  }

  if (title.length < 2 || title.length > 300) {
    return NextResponse.json(
      { error: "Title must be 2-300 characters." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `${getApiBaseUrl()}/journals/${encodeURIComponent(params.slug)}/articles`,
      {
        method: "POST",
        headers: internalHeaders(),
        body: JSON.stringify({
          title,
          abstract,
          body,
          coauthors,
          submitter_type: "user",
          submitter_id: sessionUser.id,
          source_url: sourceUrl,
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
