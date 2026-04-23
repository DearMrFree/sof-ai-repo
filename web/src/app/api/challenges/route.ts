import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

const ALLOWED_TAGS = new Set([
  "confusing",
  "broken",
  "missing",
  "question",
  "idea",
]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as
    | { id?: string; name?: string | null; email?: string | null }
    | undefined;
  if (!sessionUser?.id) {
    return NextResponse.json(
      { error: "Sign in to log a challenge." },
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
    body?: unknown;
    tag?: unknown;
    page_url?: unknown;
    lesson_slug?: unknown;
  };

  const body = typeof p.body === "string" ? p.body.trim() : "";
  const tag = typeof p.tag === "string" ? p.tag : "";
  const pageUrl = typeof p.page_url === "string" ? p.page_url : null;
  const lessonSlug =
    typeof p.lesson_slug === "string" ? p.lesson_slug : null;

  if (body.length < 3) {
    return NextResponse.json(
      { error: "Tell us a bit more about what went wrong." },
      { status: 400 },
    );
  }
  if (body.length > 2000) {
    return NextResponse.json(
      { error: "Please keep it under 2000 characters." },
      { status: 400 },
    );
  }
  if (!ALLOWED_TAGS.has(tag)) {
    return NextResponse.json(
      { error: `Tag must be one of ${Array.from(ALLOWED_TAGS).join(", ")}.` },
      { status: 400 },
    );
  }

  const handle =
    sessionUser.name ??
    (sessionUser.email ? sessionUser.email.split("@")[0] : "anon");

  try {
    const res = await fetch(`${getApiBaseUrl()}/challenges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: sessionUser.id,
        handle,
        body,
        tag,
        page_url: pageUrl,
        lesson_slug: lessonSlug,
      }),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream ${res.status}: ${text || "error"}` },
        { status: 502 },
      );
    }
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Couldn't reach the challenges backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  try {
    const res = await fetch(`${getApiBaseUrl()}/challenges${qs}`, {
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
          "Couldn't reach the challenges backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
}
