/**
 * Proxy: GET /api/journals → FastAPI /journals (listing, public)
 * Proxy: POST /api/journals → FastAPI /journals (found a journal, auth-gated)
 *
 * The POST route overrides editor_in_chief_id with the authenticated
 * session user's id — so a client can't stamp someone else's handle on
 * the founding payout. Mirrors the pattern used by /api/wallet/transfer.
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

export async function GET() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/journals`, { cache: "no-store" });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Couldn't reach the journals backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string } | undefined;
  if (!sessionUser?.id) {
    return NextResponse.json(
      { error: "Sign in to found a journal." },
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
    slug?: unknown;
    title?: unknown;
    description?: unknown;
    topic_tags?: unknown;
  };

  const title = typeof p.title === "string" ? p.title.trim() : "";
  const slug = typeof p.slug === "string" ? p.slug.trim() : "";
  const description =
    typeof p.description === "string" ? p.description.slice(0, 2000) : "";
  const topicTags = Array.isArray(p.topic_tags)
    ? p.topic_tags.filter((t): t is string => typeof t === "string").slice(0, 20)
    : [];

  if (title.length < 2 || title.length > 200) {
    return NextResponse.json(
      { error: "Title must be 2-200 characters." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/journals`, {
      method: "POST",
      headers: internalHeaders(),
      body: JSON.stringify({
        slug,
        title,
        description,
        topic_tags: topicTags,
        editor_in_chief_type: "user",
        editor_in_chief_id: sessionUser.id, // override, never trust client
      }),
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Couldn't reach the journals backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
}
