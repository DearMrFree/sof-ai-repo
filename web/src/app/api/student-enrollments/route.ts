/**
 * Proxy: /api/student-enrollments → FastAPI /student-enrollments
 *
 * GET is public (anyone can see who's enrolled at sof.ai).
 * POST requires Dr. Cheteni's NextAuth session — only the founder /
 * trio can enroll new students.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { APPROVER_EMAIL } from "@/lib/applications/trio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function internalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  return headers;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.search;
  const res = await fetch(`${getApiBaseUrl()}/student-enrollments${qs}`, {
    cache: "no-store",
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { email?: string } | undefined;
  const email = (sessionUser?.email ?? "").trim().toLowerCase();
  if (email !== APPROVER_EMAIL) {
    return NextResponse.json(
      { error: "Only Dr. Freedom Cheteni can enroll new students." },
      { status: 403 },
    );
  }
  const body = await req.text();
  const res = await fetch(`${getApiBaseUrl()}/student-enrollments`, {
    method: "POST",
    headers: internalHeaders(),
    body,
    cache: "no-store",
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
