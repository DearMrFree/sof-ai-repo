/**
 * Proxy: POST /api/articles/{id}/approve → FastAPI /articles/{id}/approve
 *
 * Final-approval gate for Living Articles. Two layers of defense:
 *   1. The proxy verifies the signed-in user's email matches Dr. Cheteni's.
 *   2. The FastAPI route re-checks the email server-side (defense in depth).
 *
 * This double-check means even a leaked INTERNAL_API_KEY can't be used to
 * approve articles on Dr. Cheteni's behalf — the human gate is enforced
 * on the trusted side too.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPROVER_EMAIL = "freedom@thevrschool.org";

export async function POST(
  _req: Request,
  ctx: { params: { id: string } },
) {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "article id must be a positive integer." },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as
    | { id?: string; email?: string }
    | undefined;
  const email = (sessionUser?.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Sign in to approve a Living Article." },
      { status: 401 },
    );
  }
  if (email !== APPROVER_EMAIL) {
    return NextResponse.json(
      {
        error:
          "Only Dr. Freedom Cheteni can approve a Living Article (signed in as " +
          email +
          ").",
      },
      { status: 403 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/articles/${id}/approve`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({ approver_email: email }),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type":
          res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Couldn't reach the articles backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
}
