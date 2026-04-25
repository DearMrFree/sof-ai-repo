/**
 * Proxy: POST /api/applications/{id}/comments
 *
 * Authenticated users post a comment on a publicly-listed application.
 * The FastAPI backend enforces public_listing=true.
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
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to comment." },
      { status: 401 },
    );
  }
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid application id" }, { status: 400 });
  }

  let body: { body?: string };
  try {
    body = (await req.json()) as { body?: string };
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const text = (body.body ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Comment cannot be empty." }, { status: 422 });
  }
  if (text.length > 4000) {
    return NextResponse.json(
      { error: "Comment is too long (max 4000 characters)." },
      { status: 422 },
    );
  }

  const upstream = await fetch(
    `${getApiBaseUrl()}/applications/${id}/comments`,
    {
      method: "POST",
      headers: internalHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        user_id: userIdFor(user),
        user_name: user.name ?? "",
        body: text,
      }),
    },
  );
  const upstreamText = await upstream.text();
  return new NextResponse(upstreamText, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
