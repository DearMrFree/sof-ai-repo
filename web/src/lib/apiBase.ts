/**
 * Server-side API base URL resolution.
 *
 * Preference order:
 *   1. SOF_API_URL (server-only — preferred; doesn't leak to the browser)
 *   2. NEXT_PUBLIC_API_BASE_URL (public; also exposed to the browser)
 *   3. fallback to the deployed Fly backend so previews work out of the box
 *
 * The fallback points at the canonical production backend hostname
 * ``sofai.fly.dev``; it's used only when neither env var is set (local
 * `next dev` without `.env.local`, ad-hoc Vercel preview deploys that
 * didn't inherit env vars, etc.) so getting this URL right matters.
 */
export function getApiBaseUrl(): string {
  return (
    process.env.SOF_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://sofai.fly.dev"
  ).replace(/\/$/, "");
}
