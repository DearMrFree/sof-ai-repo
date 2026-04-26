/**
 * Proxy: /api/student-enrollments/[id] → FastAPI /student-enrollments/{id}
 *
 * GET is public. PATCH requires Freedom's session.
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

export async function GET(
  _req: Request,
  ctx: { params: { id: string } },
) {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const res = await fetch(`${getApiBaseUrl()}/student-enrollments/${id}`, {
    cache: "no-store",
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { email?: string } | undefined;
  const email = (sessionUser?.email ?? "").trim().toLowerCase();
  if (email !== APPROVER_EMAIL) {
    return NextResponse.json(
      { error: "Only Dr. Freedom Cheteni can update enrollments." },
      { status: 403 },
    );
  }
  const id = Number(ctx.params.id);
  const body = await req.text();
  const res = await fetch(`${getApiBaseUrl()}/student-enrollments/${id}`, {
    method: "PATCH",
    headers: internalHeaders(),
    body,
    cache: "no-store",
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
