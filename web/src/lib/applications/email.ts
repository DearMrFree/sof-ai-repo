/**
 * Transactional email for the agent-onboarding flow.
 *
 * Resend (https://resend.com) is the carrier — clean REST API, free
 * tier covers our volume. The `from` address falls back to
 * `onboarding@resend.dev` (Resend's default sandbox sender) until
 * `EMAIL_FROM` is set to a verified domain like `noreply@sof.ai`.
 *
 * If `RESEND_API_KEY` is missing the helper logs the email body and
 * returns success — keeps the rest of the pipeline working in
 * dev / preview environments without a real key, while the proxy
 * surfaces a UI hint.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface SendEmailResult {
  delivered: boolean;
  provider: "resend" | "logged";
  messageId?: string;
  error?: string;
}

function defaultFrom(): string {
  return process.env.EMAIL_FROM ?? "School of AI <onboarding@resend.dev>";
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn(
      "[applications/email] RESEND_API_KEY not set; logging instead of sending.",
      { to: input.to, subject: input.subject },
    );
    return { delivered: false, provider: "logged" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: defaultFrom(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!res.ok) {
      return {
        delivered: false,
        provider: "resend",
        error: json.message ?? `Resend returned ${res.status}.`,
      };
    }
    return {
      delivered: true,
      provider: "resend",
      messageId: json.id,
    };
  } catch (err) {
    return {
      delivered: false,
      provider: "resend",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface ReviewerEmailContext {
  applicationId: number;
  applicantName: string;
  applicantEmail: string;
  agentName: string;
  applicantKind: string;
  missionStatement: string;
  apaStatement: string;
  vetRecommendation: string;
  reviewerName: string;
  reviewerEmail: string;
  reviewLink: string;
}

/**
 * Render the trio-reviewer email asking for a yes/no/maybe vote.
 * Returns matched plaintext + HTML so accessibility / inbox-rendering
 * variants can both be served by Resend.
 */
export function renderReviewerEmail(ctx: ReviewerEmailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[sof.ai] Vote needed: ${ctx.agentName || ctx.applicantName} — application #${ctx.applicationId}`;
  const safeMission = ctx.missionStatement.replace(/\n+/g, "<br/>");
  const safeApa = ctx.apaStatement.replace(/\n+/g, "<br/>");
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; color: #0f172a; max-width: 640px;">
      <h1 style="font-size: 20px; margin: 0 0 8px 0;">A new applicant needs your vote.</h1>
      <p style="margin: 0 0 16px 0; color: #334155;">
        Hi ${ctx.reviewerName.split(" ")[0] || "there"} — Devin has finished its first-pass vetting on a new sof.ai applicant. Two of three trio votes plus Devin's synthesis decide whether they get conditional acceptance.
      </p>
      <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin: 16px 0 4px;">Applicant</h2>
      <p style="margin: 0 0 16px 0;">
        <strong>${ctx.applicantName}</strong>${ctx.agentName ? ` &middot; ${ctx.agentName}` : ""}<br/>
        <span style="color: #64748b;">${ctx.applicantKind.replace(/_/g, " ")}</span>
      </p>
      <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin: 16px 0 4px;">Mission alignment</h2>
      <p style="margin: 0 0 16px 0; color: #334155;">${safeMission}</p>
      <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin: 16px 0 4px;">APA alignment</h2>
      <p style="margin: 0 0 16px 0; color: #334155;">${safeApa}</p>
      <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin: 16px 0 4px;">Devin's recommendation</h2>
      <p style="margin: 0 0 24px 0; color: #334155;">${ctx.vetRecommendation || "(no recommendation provided)"}</p>
      <p style="margin: 0 0 24px 0;">
        <a href="${ctx.reviewLink}" style="display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 600;">Cast your vote</a>
      </p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
        This link is signed with HMAC-SHA256 and expires in 30 days. You can change your vote until all three reviewers have submitted.
      </p>
    </div>
  `;
  const text = [
    `A new sof.ai applicant needs your vote.`,
    ``,
    `Applicant: ${ctx.applicantName}${ctx.agentName ? ` · ${ctx.agentName}` : ""}`,
    `Kind: ${ctx.applicantKind.replace(/_/g, " ")}`,
    ``,
    `Mission alignment:`,
    ctx.missionStatement,
    ``,
    `APA alignment:`,
    ctx.apaStatement,
    ``,
    `Devin's recommendation:`,
    ctx.vetRecommendation || "(no recommendation provided)",
    ``,
    `Cast your vote:`,
    ctx.reviewLink,
    ``,
    `(Signed link, expires in 30 days. You can change your vote until all three reviewers have submitted.)`,
  ].join("\n");
  return { subject, html, text };
}
