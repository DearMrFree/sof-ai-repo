/**
 * Proxy: POST/DELETE /api/applications/{id}/like
 *
 * Authenticated users (NextAuth session) like or un-like a publicly-listed
 * application. The user_id forwarded to the API is the session.user.id (or
 * a hashed-email fallback) so likes are tied to a real account, not raw
 * IPs / cookies. The FastAPI backend enforces public_listing=true.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function internalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  return headers;
}

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
}

function userIdFor(user: SessionUser): string {
  if (user.id) return user.id;
  if (user.email) return `email:${user.email.toLowerCase()}`;
  return "anonymous";
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to like applications." },
      { status: 401 },
    );
  }
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid application id" }, { status: 400 });
  }
  const upstream = await fetch(`${getApiBaseUrl()}/applications/${id}/like`, {
    method: "POST",
    headers: internalHeaders(),
    cache: "no-store",
    body: JSON.stringify({
      user_id: userIdFor(user),
      user_name: user.name ?? "",
    }),
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to manage your likes." },
      { status: 401 },
    );
  }
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid application id" }, { status: 400 });
  }
  const userId = encodeURIComponent(userIdFor(user));
  const upstream = await fetch(
    `${getApiBaseUrl()}/applications/${id}/like?user_id=${userId}`,
    {
      method: "DELETE",
      headers: internalHeaders(),
      cache: "no-store",
    },
  );
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
