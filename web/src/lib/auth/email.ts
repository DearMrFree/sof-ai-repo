/**
 * Magic-link email rendering. Reuses the Resend helper from
 * applications/email.ts (same carrier, same env vars, same fall-back to
 * "logged" provider when ``RESEND_API_KEY`` is unset). Centralised here
 * so the magic-link branding is one place to tune.
 */

import { sendEmail, type SendEmailResult } from "@/lib/applications/email";
import { displayNameFromEmail } from "@/lib/personaGen";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export interface SendMagicLinkArgs {
  to: string;
  link: string;
  ttlMinutes: number;
}

export async function sendMagicLinkEmail(
  args: SendMagicLinkArgs,
): Promise<SendEmailResult> {
  const safeName = escapeHtml(displayNameFromEmail(args.to) || "there");
  // The link is a same-origin URL we minted. Still encode so the href
  // round-trips through email clients that aggressively rewrite URLs.
  const safeLink = encodeURI(args.link);
  const subject = `Sign in to School of AI`;

  const text = [
    `Hi ${safeName},`,
    ``,
    `Click the link below to sign in to School of AI. This link expires in ${args.ttlMinutes} minutes and can only be used once.`,
    ``,
    args.link,
    ``,
    `If you didn't request this, ignore this email — your inbox stays untouched.`,
    ``,
    `— School of AI · The VR School`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; color: #0f172a; max-width: 560px; padding: 16px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:24px;">
        <div style="width:28px; height:28px; border-radius:6px; background:linear-gradient(135deg,#10b981,#f97316); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:14px;">✦</div>
        <span style="font-weight:600;">School of AI · <span style="color:#10b981;">The VR School</span></span>
      </div>
      <h1 style="font-size: 22px; margin: 0 0 12px 0;">Hi ${safeName} — your sign-in link</h1>
      <p style="margin: 0 0 18px 0; color: #334155; line-height: 1.55;">
        Click the button below to finish signing in. This link expires in ${args.ttlMinutes} minutes
        and can only be used once.
      </p>
      <p style="margin: 0 0 24px 0;">
        <a href="${safeLink}"
           style="background: linear-gradient(135deg,#10b981,#f97316); color:#fff;
                  text-decoration:none; padding: 12px 22px; border-radius: 10px;
                  font-weight: 600; display: inline-block; font-size: 15px;">
          Sign in to School of AI
        </a>
      </p>
      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">
        Or paste this URL into your browser:
      </p>
      <p style="margin: 0 0 24px 0; color: #475569; font-size: 13px; word-break: break-all;">
        <a href="${safeLink}" style="color: #10b981;">${safeLink}</a>
      </p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
        If you didn't request this email, just ignore it — your inbox stays untouched.
      </p>
    </div>
  `;

  return sendEmail({ to: args.to, subject, html, text });
}
