/**
 * /api/users/onboarding
 *
 * POST — proxy the wizard's submission to FastAPI's
 * `/users/onboarding` endpoint with the internal-auth header. NextAuth-
 * gated so an unauthenticated visitor can't force-create a profile;
 * the email must match the session's email.
 */
import { NextResponse, type NextRequest } from "next/server";
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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionEmail = (session?.user?.email ?? "").toLowerCase();
  if (!sessionEmail) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Force the email on the body to match the session — visitors cannot
  // sign up someone else.
  body.email = sessionEmail;

  const url = `${getApiBaseUrl()}/users/onboarding`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: internalHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "upstream unreachable", detail: String(err) },
      { status: 502 },
    );
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return NextResponse.json(json, { status: res.status });
}
