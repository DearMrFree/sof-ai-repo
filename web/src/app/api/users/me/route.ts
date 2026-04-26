/**
 * /api/users/me
 *
 * GET — read the current session-user's profile. Returns 404 if the
 * authenticated user hasn't completed `/welcome` yet — the page uses
 * that signal to decide between "edit your profile" and "first-run
 * wizard".
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const upstream = `${getApiBaseUrl()}/users/${encodeURIComponent(email)}`;
  let res: Response;
  try {
    res = await fetch(upstream, { cache: "no-store" });
  } catch (err) {
    return NextResponse.json(
      { error: "upstream unreachable", detail: String(err) },
      { status: 502 },
    );
  }
  const json = await res.json().catch(() => null);
  return NextResponse.json(json, { status: res.status });
}
