/**
 * /api/applications/{id}/notify-trio — re-send (or re-send) reviewer emails
 * to the trio for an application that's already in `trio_reviewing` status.
 *
 * Why this exists: the vet endpoint dispatches the trio emails as a side
 * effect of vet=passed, but if `RESEND_API_KEY` was unset at that moment
 * (or any other transient delivery error) the trio never got the link.
 * This endpoint is the recovery handle: gated to Dr. Cheteni, idempotent,
 * pure email-resend without touching the application state.
 *
 * Body: ignored. Auth: NextAuth session === APPROVER_EMAIL.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { sendEmail, renderReviewerEmail } from "@/lib/applications/email";
import { signReviewToken } from "@/lib/applications/token";
import { APPROVER_EMAIL, TRIO } from "@/lib/applications/trio";
import { apiBase } from "@/lib/apiBase";

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

interface ApplicationRow {
  id: number;
  applicant_kind: string;
  applicant_name: string;
  applicant_email: string;
  agent_name: string;
  mission_statement: string;
  apa_statement: string;
  vet_recommendation: string;
  status: string;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (
    !session?.user?.email ||
    session.user.email.toLowerCase() !== APPROVER_EMAIL.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "Only the approver can trigger trio notifications." },
      { status: 401 },
    );
  }

  const { id: idParam } = await ctx.params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const appRes = await fetch(`${apiBase()}/applications/${id}`, {
    cache: "no-store",
  });
  if (!appRes.ok) {
    return NextResponse.json(
      { error: "application not found" },
      { status: appRes.status },
    );
  }
  const application = (await appRes.json()) as ApplicationRow;
  if (application.status !== "trio_reviewing") {
    return NextResponse.json(
      {
        error: `application is in status '${application.status}'; must be in 'trio_reviewing' to notify the trio.`,
      },
      { status: 409 },
    );
  }

  const baseUrl = publicBaseUrl(req);
  let emails_sent = 0;
  const email_errors: string[] = [];
  for (const reviewer of TRIO) {
    const token = signReviewToken(id, reviewer.email);
    const reviewLink = `${baseUrl}/applications/${id}/review?token=${encodeURIComponent(token)}`;
    const { subject, html, text } = renderReviewerEmail({
      applicationId: id,
      applicantName: application.applicant_name,
      applicantEmail: application.applicant_email,
      agentName: application.agent_name,
      applicantKind: application.applicant_kind,
      missionStatement: application.mission_statement,
      apaStatement: application.apa_statement,
      vetRecommendation: application.vet_recommendation,
      reviewerName: reviewer.name,
      reviewerEmail: reviewer.email,
      reviewLink,
    });
    const result = await sendEmail({
      to: reviewer.email,
      subject,
      html,
      text,
      replyTo: application.applicant_email,
    });
    if (result.delivered) emails_sent += 1;
    else if (result.error) email_errors.push(`${reviewer.email}: ${result.error}`);
    else email_errors.push(`${reviewer.email}: ${result.provider} (no api key)`);
  }

  return NextResponse.json({ emails_sent, email_errors });
}
