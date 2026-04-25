import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

const ALLOWED_ROLES = new Set(["contributor", "learner", "reviewer", "mentor"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resolve the effective inviter id the FastAPI layer will check against its
 * privileged allow-list. NextAuth stores the stable id as user.id, but the
 * well-known principal (Dr. Freedom Cheteni) also has a legacy "freedom"
 * form — we pass whichever is set so either works upstream.
 */
function resolveInviterId(
  sessionUser: { id?: string; email?: string | null } | undefined,
): string | null {
  if (!sessionUser?.id) return null;
  return sessionUser.id;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as
    | { id?: string; name?: string | null; email?: string | null }
    | undefined;
  const inviterId = resolveInviterId(sessionUser);
  if (!inviterId) {
    return NextResponse.json(
      { error: "Sign in as a principal or instructor to send invitations." },
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
    email?: unknown;
    name?: unknown;
    role?: unknown;
    program_slug?: unknown;
    message?: unknown;
  };

  const email = typeof p.email === "string" ? p.email.trim().toLowerCase() : "";
  const name =
    typeof p.name === "string" && p.name.trim() ? p.name.trim() : null;
  const role = typeof p.role === "string" ? p.role : "contributor";
  const programSlug =
    typeof p.program_slug === "string" && p.program_slug.trim()
      ? p.program_slug.trim()
      : null;
  const message =
    typeof p.message === "string" && p.message.trim() ? p.message.trim() : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json(
      { error: `role must be one of ${Array.from(ALLOWED_ROLES).join(", ")}.` },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviter_id: inviterId,
        email,
        name,
        role,
        program_slug: programSlug,
        message,
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
          "Couldn't reach the invitations backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string } | undefined;
  if (!sessionUser?.id) {
    return NextResponse.json(
      { error: "Sign in to view invitations." },
      { status: 401 },
    );
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const qs = new URLSearchParams();
  // Always scope list to the signed-in inviter so a random user can't read
  // all pending invites.
  qs.set("inviter_id", sessionUser.id);
  if (status) qs.set("status", status);
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/invitations?${qs.toString()}`,
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
      {
        error:
          "Couldn't reach the invitations backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
}
