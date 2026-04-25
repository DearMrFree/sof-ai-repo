/**
 * Who may access the /classroom/invite admin UI.
 *
 * We keep this in a tiny client-usable module so both the page component
 * and the (eventual) middleware share a single source of truth. Upstream
 * FastAPI is still authoritative — even if somebody bypasses this the
 * create-invitation endpoint will 403 — but checking here avoids rendering
 * the form for everyone else.
 */

/** Handles allowed to invite new humans. Keep lowercase. */
export const PRIVILEGED_HANDLES = new Set(["freedom"]);

/** Emails allowed to invite new humans. Keep lowercase. */
export const PRIVILEGED_EMAILS = new Set(["freedom@thevrschool.org"]);

export function canInvite(
  user: { email?: string | null; name?: string | null; id?: string } | undefined,
): boolean {
  if (!user) return false;
  const email = user.email?.toLowerCase() ?? "";
  if (PRIVILEGED_EMAILS.has(email)) return true;
  // The NextAuth session.user.id shape for privileged people is
  // "email:<lowercased email>" — check that too so an alternate signin
  // path (Google OAuth etc.) still works.
  if (typeof user.id === "string" && user.id.startsWith("email:")) {
    if (PRIVILEGED_EMAILS.has(user.id.slice("email:".length))) return true;
  }
  const handle = user.name?.toLowerCase() ?? "";
  if (PRIVILEGED_HANDLES.has(handle)) return true;
  return false;
}
