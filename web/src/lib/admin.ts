/**
 * Admin gate.
 *
 * Source of truth: a user counts as an admin if (a) their FastAPI
 * UserProfile has `user_type === "administrator"`, OR (b) they're on
 * the founder allowlist (Freedom — the platform owner — should always
 * have admin access even before completing onboarding).
 *
 * The check is server-side only. Client components must never decide
 * admin status on their own — they call gated proxies and let the
 * server-side check decide.
 */
import { getApiBaseUrl } from "@/lib/apiBase";

const FOUNDER_EMAILS = new Set([
  "freedom@thevrschool.org",
  "freedom@sof.ai",
]);

export function isFounderEmail(email: string): boolean {
  return FOUNDER_EMAILS.has(email.toLowerCase());
}

export async function isAdmin(email: string): Promise<boolean> {
  const e = email.toLowerCase();
  if (!e) return false;
  if (isFounderEmail(e)) return true;
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/users/${encodeURIComponent(e)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return false;
    const profile = (await res.json()) as { user_type?: string };
    return profile?.user_type === "administrator";
  } catch {
    return false;
  }
}
