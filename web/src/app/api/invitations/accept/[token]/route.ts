import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

const TOKEN_RE = /^[A-Za-z0-9_-]{16,200}$/;

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json(
      { error: "Invalid invitation token." },
      { status: 404 },
    );
  }
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/invitations/accept/${encodeURIComponent(token)}`,
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

export async function POST(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json(
      { error: "Invalid invitation token." },
      { status: 404 },
    );
  }
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string } | undefined;
  // Accepted_user_id is optional — if the invitee hasn't signed in yet we
  // still mark the invitation accepted (the frontend may nudge them into
  // signing in next).
  const acceptedUserId = sessionUser?.id ?? null;
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/invitations/accept/${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted_user_id: acceptedUserId }),
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
      {
        error:
          "Couldn't reach the invitations backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
}
