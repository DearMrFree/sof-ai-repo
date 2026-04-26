/**
 * Render and send the lead-notification email to Blajon when LuxAI1's
 * `submit_lead` tool fires. The email goes to luxservicesbayarea@gmail.com
 * (Blajon's account on file). The customer's contact info is in the body
 * with `mailto:` and `tel:` shortcuts so Blajon can respond in two taps
 * from his phone.
 */
import { sendEmail, type SendEmailResult } from "@/lib/applications/email";
import type { SubmitLeadInput } from "@/lib/embed/luxai1";

const BLAJON_EMAIL = "luxservicesbayarea@gmail.com";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function humanService(slug: string): string {
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function notifyBlajon(
  lead: SubmitLeadInput,
  meta: { transcript: string; userAgent?: string },
): Promise<SendEmailResult> {
  const safe = {
    name: escapeHtml(lead.name),
    phone: lead.phone ? escapeHtml(lead.phone) : "",
    email: lead.email ? escapeHtml(lead.email) : "",
    service: escapeHtml(humanService(lead.service)),
    address: lead.address_or_zip ? escapeHtml(lead.address_or_zip) : "",
    when: lead.preferred_time ? escapeHtml(lead.preferred_time) : "",
    notes: lead.notes ? escapeHtml(lead.notes).replace(/\n+/g, "<br/>") : "",
    transcript: escapeHtml(meta.transcript).replace(/\n+/g, "<br/>"),
    ua: meta.userAgent ? escapeHtml(meta.userAgent) : "",
  };

  // Both hrefs need belt-and-suspenders sanitization since they're
  // interpolated into HTML attribute values. Phone strips to digits
  // and `+`; email is HTML-escaped so a quote character in the
  // address can't break out of the attribute.
  const phoneHref = lead.phone ? `tel:${lead.phone.replace(/[^+\d]/g, "")}` : "";
  const emailHref = lead.email ? `mailto:${escapeHtml(lead.email)}` : "";

  // Email subject is plain text, NOT HTML — use raw values so an
  // apostrophe in the customer's name doesn't render as `O&#x27;Brien`
  // in Blajon's inbox. The HTML-escaped `safe.*` aliases stay
  // reserved for the html body below.
  const subject = `[AI1 lead] ${humanService(lead.service)} \u2014 ${lead.name}`;
  const text = [
    `New lead from LuxAI1 on ai1.llc`,
    ``,
    `Name:     ${lead.name}`,
    lead.phone ? `Phone:    ${lead.phone}` : null,
    lead.email ? `Email:    ${lead.email}` : null,
    `Service:  ${humanService(lead.service)}`,
    lead.address_or_zip ? `Where:    ${lead.address_or_zip}` : null,
    lead.preferred_time ? `When:     ${lead.preferred_time}` : null,
    lead.notes ? `Notes:    ${lead.notes}` : null,
    ``,
    `--- Conversation ---`,
    meta.transcript,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; color: #0f172a; max-width: 640px;">
      <h1 style="font-size: 20px; margin: 0 0 8px;">New lead from LuxAI1</h1>
      <p style="margin: 0 0 16px; color: #475569;">A visitor on ai1.llc just asked LuxAI1 to take their info. Two-tap reply below.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 0 0 16px;">
        <tr><td style="padding: 6px 0; color: #64748b; width: 110px;">Name</td><td style="padding: 6px 0;"><strong>${safe.name}</strong></td></tr>
        ${
          lead.phone
            ? `<tr><td style="padding: 6px 0; color: #64748b;">Phone</td><td style="padding: 6px 0;"><a href="${phoneHref}" style="color: #0f766e;">${safe.phone}</a></td></tr>`
            : ""
        }
        ${
          lead.email
            ? `<tr><td style="padding: 6px 0; color: #64748b;">Email</td><td style="padding: 6px 0;"><a href="${emailHref}" style="color: #0f766e;">${safe.email}</a></td></tr>`
            : ""
        }
        <tr><td style="padding: 6px 0; color: #64748b;">Service</td><td style="padding: 6px 0;">${safe.service}</td></tr>
        ${
          lead.address_or_zip
            ? `<tr><td style="padding: 6px 0; color: #64748b;">Where</td><td style="padding: 6px 0;">${safe.address}</td></tr>`
            : ""
        }
        ${
          lead.preferred_time
            ? `<tr><td style="padding: 6px 0; color: #64748b;">When</td><td style="padding: 6px 0;">${safe.when}</td></tr>`
            : ""
        }
        ${
          lead.notes
            ? `<tr><td style="padding: 6px 0; color: #64748b; vertical-align: top;">Notes</td><td style="padding: 6px 0;">${safe.notes}</td></tr>`
            : ""
        }
      </table>
      <details style="margin: 12px 0; color: #475569; font-size: 13px;">
        <summary style="cursor: pointer;">View full conversation</summary>
        <div style="margin-top: 8px; padding: 12px; background: #f8fafc; border-radius: 6px; white-space: pre-wrap;">${safe.transcript}</div>
      </details>
      <p style="margin: 16px 0 0; color: #94a3b8; font-size: 12px;">Sent by LuxAI1 \u00b7 trained at <a href="https://sof.ai" style="color: #94a3b8;">School of AI</a></p>
    </div>
  `;

  return sendEmail({ to: BLAJON_EMAIL, subject, html, text });
}
