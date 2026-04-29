/**
 * Best-effort upsert into the shared FastAPI ``UserProfile`` row keyed
 * on email. Called from NextAuth's ``signIn`` callback so every Pioneer
 * who signs in here exists across all three sister sites the moment
 * they authenticate, even before they hit ``/welcome`` or ``/settings``.
 *
 * The endpoint is idempotent + non-clobbering — first touch creates
 * a minimal row; subsequent touches return the existing row unchanged
 * so any wizard- or settings-customisation is never overwritten.
 *
 * Failures are swallowed: NextAuth's signIn callback returns ``true``
 * unconditionally — sign-in must NOT fail because the shared identity
 * store is briefly unreachable (cold start, deploy in flight, etc.).
 */

import { getApiBaseUrl } from "@/lib/apiBase";

const TOUCH_TIMEOUT_MS = 4_000;

export interface TouchInput {
  email: string;
  name?: string | null;
  image?: string | null;
}

export async function touchUserOnSignIn(input: TouchInput): Promise<void> {
  const email = (input.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return;
  // Guests are intentionally ephemeral — persisting every random
  // visitor would pollute the directory + admin views.
  if (email.endsWith("@guest.sof.ai")) return;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TOUCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${getApiBaseUrl()}/users/touch`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        display_name: input.name ?? "",
        photo_url: input.image ?? "",
      }),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) {
      // Don't throw — log + move on.
      console.warn(
        `touchUserOnSignIn: ${res.status} for ${email}`,
        await res.text().catch(() => ""),
      );
    }
  } catch (err) {
    console.warn(`touchUserOnSignIn: ${email}`, err);
  } finally {
    clearTimeout(timer);
  }
}
