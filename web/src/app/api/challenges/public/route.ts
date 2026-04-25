import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBase";

const ALLOWED_TAGS = new Set([
  "confusing",
  "broken",
  "missing",
  "question",
  "idea",
]);

// Very light email format check — just enough to reject obvious junk at the
// proxy layer. The upstream FastAPI uses pydantic's EmailStr (backed by
// email-validator) for the real validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public (unauthenticated) feedback submission.
 *
 * This endpoint deliberately does NOT check getServerSession — it's the
 * "let the whole internet leave feedback" door. The backend enforces the
 * hard limits (honeypot, per-email rate, 1000-char body cap); this layer
 * just validates shape and forwards.
 */
export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const p = payload as {
    email?: unknown;
    name?: unknown;
    body?: unknown;
    tag?: unknown;
    page_url?: unknown;
    program_slug?: unknown;
    lesson_slug?: unknown;
    website?: unknown;
  };

  const email = typeof p.email === "string" ? p.email.trim().toLowerCase() : "";
  const name =
    typeof p.name === "string" && p.name.trim() ? p.name.trim() : null;
  const body = typeof p.body === "string" ? p.body.trim() : "";
  const tag = typeof p.tag === "string" ? p.tag : "";
  const rawPageUrl = typeof p.page_url === "string" ? p.page_url.trim() : "";
  const pageUrl =
    rawPageUrl &&
    (rawPageUrl.toLowerCase().startsWith("http://") ||
      rawPageUrl.toLowerCase().startsWith("https://"))
      ? rawPageUrl
      : null;
  const programSlug =
    typeof p.program_slug === "string" ? p.program_slug : null;
  const lessonSlug =
    typeof p.lesson_slug === "string" ? p.lesson_slug : null;
  const honeypot = typeof p.website === "string" ? p.website : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  if (body.length < 3) {
    return NextResponse.json(
      { error: "Tell us a bit more about what went wrong." },
      { status: 400 },
    );
  }
  if (body.length > 1000) {
    return NextResponse.json(
      { error: "Please keep it under 1000 characters." },
      { status: 400 },
    );
  }
  if (!ALLOWED_TAGS.has(tag)) {
    return NextResponse.json(
      { error: `Tag must be one of ${Array.from(ALLOWED_TAGS).join(", ")}.` },
      { status: 400 },
    );
  }
  if (rawPageUrl && !pageUrl) {
    return NextResponse.json(
      { error: "page_url must be an http(s) URL." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/challenges/public`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        name,
        body,
        tag,
        page_url: pageUrl,
        program_slug: programSlug,
        lesson_slug: lessonSlug,
        website: honeypot,
      }),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      // Keep the upstream status code for 429 / 400 so the client can
      // show the right message ("you hit the rate limit") rather than a
      // generic 502.
      return new NextResponse(text, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("Content-Type") ?? "application/json",
        },
      });
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
