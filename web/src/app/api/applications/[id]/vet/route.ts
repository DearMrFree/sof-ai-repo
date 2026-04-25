/**
 * POST /api/applications/{id}/vet (admin re-trigger)
 *
 * Lets Dr. Cheteni re-run Devin's first-pass vet on an application —
 * useful if the original vet failed mid-flight (Anthropic 5xx, etc.)
 * or if the applicant resubmitted after a "needs_revision" verdict.
 *
 * Public submission already triggers an inline vet from POST
 * /api/applications, so this endpoint is a recovery lever, not the
 * primary path.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/apiBase";
import { runDevinVet } from "@/lib/applications/vetting";
import { sendEmail, renderReviewerEmail } from "@/lib/applications/email";
import { signReviewToken } from "@/lib/applications/token";
import { APPROVER_EMAIL, TRIO } from "@/lib/applications/trio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function internalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  return headers;
}

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

export async function POST(
  req: Request,
  ctx: { params: { id: string } },
) {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "application id must be a positive integer." },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { email?: string } | undefined;
  const email = (sessionUser?.email ?? "").trim().toLowerCase();
  if (email !== APPROVER_EMAIL) {
    return NextResponse.json(
      { error: "Only Dr. Freedom Cheteni can re-run vetting." },
      { status: 403 },
    );
  }

  const detailRes = await fetch(`${getApiBaseUrl()}/applications/${id}`, {
    cache: "no-store",
  });
  if (!detailRes.ok) {
    return new NextResponse(await detailRes.text(), {
      status: detailRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const application = (await detailRes.json()) as {
    id: number;
    applicant_kind: string;
    applicant_name: string;
    applicant_email: string;
    org_name: string;
    agent_name: string;
    agent_url: string;
    mission_statement: string;
    apa_statement: string;
    public_review_url: string;
    public_listing: boolean;
    likes_count?: number;
    comments_count?: number;
    comments?: { user_name: string; body: string }[];
  };

  // Fold public-engagement signal into the re-vet so applications that
  // have accumulated likes/comments since the original vet get judged
  // with that evidence in hand. Private listings pass `null` so the
  // prompt tells Devin "no public lane".
  const publicSignal = application.public_listing
    ? {
        likes: application.likes_count ?? 0,
        comments: application.comments_count ?? 0,
        recentComments: (application.comments ?? []).slice(-5),
      }
    : null;

  let vet;
  try {
    vet = await runDevinVet({
      applicantKind: application.applicant_kind,
      applicantName: application.applicant_name,
      agentName: application.agent_name,
      orgName: application.org_name,
      agentUrl: application.agent_url,
      missionStatement: application.mission_statement,
      apaStatement: application.apa_statement,
      publicReviewUrl: application.public_review_url,
      publicSignal,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Vet failed: " + (err instanceof Error ? err.message : String(err)) },
      { status: 502 },
    );
  }

  const persistRes = await fetch(`${getApiBaseUrl()}/applications/${id}/vet`, {
    method: "POST",
    headers: internalHeaders(),
    cache: "no-store",
    body: JSON.stringify({
      vet_status: vet.vet_status,
      reasoning: vet.reasoning,
      recommendation: vet.recommendation,
    }),
  });
  if (!persistRes.ok) {
    return new NextResponse(await persistRes.text(), {
      status: persistRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  let emails_sent = 0;
  const email_errors: string[] = [];
  if (vet.vet_status === "passed") {
    const baseUrl = publicBaseUrl(req);
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
        vetRecommendation: vet.recommendation,
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
    }
  }

  return NextResponse.json({
    vet,
    emails_sent,
    email_errors,
  });
}
