/**
 * /api/applications/{id}/review-links — Freedom-only fallback that
 * returns the three signed trio reviewer URLs as JSON.
 *
 * Why this exists: Resend only delivers to verified domains, so until
 * `mail.sof.ai` (or similar) is verified, emails to non-Freedom recipients
 * fail. This endpoint is the manual-forward escape hatch — Freedom can
 * pull the three signed links and forward them to Garth + Esther over
 * any channel he prefers. The links are the same HMAC-signed tokens the
 * email path produces, so the trio's votes still get audited correctly.
 *
 * Auth: NextAuth session === APPROVER_EMAIL.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { signReviewToken } from "@/lib/applications/token";
import { APPROVER_EMAIL, TRIO } from "@/lib/applications/trio";

export const runtime = "nodejs";

function publicBaseUrl(req: Request): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const host = req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`.replace(/\/$/, "");
  }
  return "https://sof.ai";
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (
    !session?.user?.email ||
    session.user.email.toLowerCase() !== APPROVER_EMAIL.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "Only the approver can view trio review links." },
      { status: 401 },
    );
  }

  const { id: idParam } = await ctx.params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const baseUrl = publicBaseUrl(req);
  const links = TRIO.map((reviewer) => {
    const token = signReviewToken(id, reviewer.email);
    const url = `${baseUrl}/applications/${id}/review?token=${encodeURIComponent(token)}`;
    return {
      reviewer_name: reviewer.name,
      reviewer_email: reviewer.email,
      review_url: url,
    };
  });

  return NextResponse.json({ application_id: id, links });
}
