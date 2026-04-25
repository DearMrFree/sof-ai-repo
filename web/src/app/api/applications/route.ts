/**
 * Proxy: POST /api/applications → FastAPI /applications
 *
 * Public submission. After persisting the row, the route fires Devin's
 * first-pass vet (via Anthropic) in the background. On `passed`, the
 * three trio members get a signed reviewer link emailed via Resend.
 *
 * The vet runs sequentially (not background-detached) because Vercel
 * function lifecycles can terminate after the response is sent — we
 * use `waitUntil` to keep the runtime alive long enough for the vet +
 * emails to land.
 */
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBase";
import { runDevinVet } from "@/lib/applications/vetting";
import { sendEmail, renderReviewerEmail } from "@/lib/applications/email";
import { signReviewToken } from "@/lib/applications/token";
import { TRIO } from "@/lib/applications/trio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ApplicationRow {
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
  status: string;
}

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

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON." },
      { status: 400 },
    );
  }

  // Forward to FastAPI to persist.
  let createRes: Response;
  try {
    createRes = await fetch(`${getApiBaseUrl()}/applications`, {
      method: "POST",
      headers: internalHeaders(),
      cache: "no-store",
      body: JSON.stringify(body),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Couldn't reach the applications backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }

  const text = await createRes.text();
  if (!createRes.ok) {
    return new NextResponse(text, {
      status: createRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const application = JSON.parse(text) as ApplicationRow;

  // Kick off Devin's vet + trio emails. We await it inline so any
  // failure surfaces in the response — the form UX shows the user
  // their actual status. Worst case the vet takes ~10s; far less
  // than maxDuration.
  let vetSummary: {
    vet_status?: string;
    emails_sent?: number;
    error?: string;
  } = {};
  try {
    vetSummary = await runVetAndDispatch(application, publicBaseUrl(req));
  } catch (err) {
    vetSummary = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json(
    { application, vet: vetSummary },
    { status: 201 },
  );
}

async function runVetAndDispatch(
  application: ApplicationRow,
  baseUrl: string,
): Promise<{
  vet_status: string;
  emails_sent: number;
  email_errors: string[];
}> {
  const vet = await runDevinVet({
    applicantKind: application.applicant_kind,
    applicantName: application.applicant_name,
    agentName: application.agent_name,
    orgName: application.org_name,
    agentUrl: application.agent_url,
    missionStatement: application.mission_statement,
    apaStatement: application.apa_statement,
    publicReviewUrl: application.public_review_url,
  });

  // Persist verdict on the API side.
  const persistRes = await fetch(
    `${getApiBaseUrl()}/applications/${application.id}/vet`,
    {
      method: "POST",
      headers: internalHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        vet_status: vet.vet_status,
        reasoning: vet.reasoning,
        recommendation: vet.recommendation,
      }),
    },
  );
  if (!persistRes.ok) {
    const detail = await persistRes.text();
    throw new Error(
      `Backend rejected vet result (${persistRes.status}): ${detail.slice(0, 200)}`,
    );
  }

  if (vet.vet_status !== "passed") {
    return { vet_status: vet.vet_status, emails_sent: 0, email_errors: [] };
  }

  let sent = 0;
  const errors: string[] = [];
  for (const reviewer of TRIO) {
    const token = signReviewToken(application.id, reviewer.email);
    const reviewLink = `${baseUrl}/applications/${application.id}/review?token=${encodeURIComponent(token)}`;
    const { subject, html, text } = renderReviewerEmail({
      applicationId: application.id,
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
    if (result.delivered) sent += 1;
    else if (result.error) errors.push(`${reviewer.email}: ${result.error}`);
  }

  return { vet_status: vet.vet_status, emails_sent: sent, email_errors: errors };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const publicOnly = url.searchParams.get("public_only");
  const apiUrl = `${getApiBaseUrl()}/applications${publicOnly === "true" ? "?public_only=true" : ""}`;
  try {
    const res = await fetch(apiUrl, { cache: "no-store" });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Couldn't reach the applications backend. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 },
    );
  }
}
