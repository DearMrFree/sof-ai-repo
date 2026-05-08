/**
 * GET /api/auth/sso/signout
 *
 * Sign-out fan-out for the canonical auth surface. Sister sites on
 * other TLDs redirect users here after clearing their own cookie so
 * that signing out anywhere clears the session everywhere.
 *
 * What this clears:
 *   - The ``__Secure-next-auth.session-token`` cookie on
 *     ``ai.thevrschool.org``. When ``NEXTAUTH_COOKIE_DOMAIN=.thevrschool.org``
 *     is set in prod (it is), the cookie is shared with the apex
 *     ``www.thevrschool.org`` and clearing it here logs the user out
 *     of both subdomains in one shot.
 *
 * Query string:
 *   ?next=https://sof.ai/   (optional; absolute URL or relative path)
 *
 * Why GET, not POST:
 *   This is reachable from a sister-domain redirect chain, so it has
 *   to work with a browser navigating directly here. NextAuth's
 *   built-in ``/api/auth/signout`` is POST-only with CSRF — fine for
 *   in-app sign-outs, awkward for cross-TLD chains. We just delete
 *   the session cookie ourselves.
 */
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same trust list as the handoff route — only these hosts can be a
// post-signout ``next`` target so a malicious link can't redirect
// users into a phishing page after signing them out.
const TRUSTED_NEXT_HOSTS = new Set([
  "sof.ai",
  "www.sof.ai",
  "ai.thevrschool.org",
  "www.thevrschool.org",
  "thevrschool.org",
  "iteachxr.com",
  "www.iteachxr.com",
  "lms.thevrschool.org",
  "iteachxr.thevrschool.org",
  // Temporary Railway production host until the LMS has a branded domain.
  "iteachxr-production.up.railway.app",
  "iteachxr-production-d1b8.up.railway.app",
  "localhost:3000",
  "localhost:3001",
  "localhost:3002",
  "localhost:5000",
]);

function resolveNext(raw: string | null, requestUrl: string): string {
  // Always return an ABSOLUTE URL. ``NextResponse.redirect()`` parses
  // its arg via ``new URL(value)`` with no base, which throws on bare
  // relative paths like ``"/"`` (``ERR_INVALID_URL``) — that would
  // crash the route handler before the cookie-clearing ``Set-Cookie``
  // headers ever shipped, leaving the user signed in.
  if (!raw) return new URL("/", requestUrl).toString();
  // Allow relative paths back to the canonical site itself.
  // Reject ``//`` (protocol-relative) AND ``/\`` (WHATWG URL parser
  // normalises backslashes to forward slashes for http/https schemes,
  // so ``/\\evil.com`` resolves to ``https://evil.com/`` — open redirect).
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) {
    // Strip control chars + CR/LF that could be smuggled into the
    // ``Location`` header (mirrors ``safeRelativeNext`` in the handoff
    // route). Without this, a request like
    // ``?next=/%0d%0aSet-Cookie:+evil=1`` could either crash Node's
    // HTTP layer (preventing the cookie from being cleared) or, worst
    // case, smuggle headers into the redirect response.
    if (/[\u0000-\u001f]/.test(raw)) return new URL("/", requestUrl).toString();
    return new URL(raw, requestUrl).toString();
  }
  try {
    const u = new URL(raw);
    // Reject non-HTTP(S) schemes. ``new URL('javascript://sof.ai/…').host``
    // evaluates to ``sof.ai``, so the trusted-host check alone would let
    // ``javascript:``/``data:``/``file:`` URLs through. Modern browsers
    // refuse to follow them via ``Location``, but custom WebViews and
    // proxies might — defence-in-depth.
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return new URL("/", requestUrl).toString();
    }
    const host = u.host.toLowerCase();
    if (TRUSTED_NEXT_HOSTS.has(host)) {
      return u.toString();
    }
  } catch {
    /* fall through */
  }
  // Untrusted target → bounce back to ourselves.
  return new URL("/", requestUrl).toString();
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = resolveNext(url.searchParams.get("next"), req.url);

  const useSecure =
    (process.env.NEXTAUTH_URL ?? "").startsWith("https://") ||
    process.env.NODE_ENV === "production";
  const cookieName = useSecure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
  const cookieDomain = process.env.NEXTAUTH_COOKIE_DOMAIN || undefined;

  const res = NextResponse.redirect(next);
  clearSessionCookies(res, cookieName, useSecure, cookieDomain);
  return res;
}

function clearSessionCookies(
  res: NextResponse,
  cookieName: string,
  secure: boolean,
  domain?: string,
) {
  const names = Array.from(new Set([
    cookieName,
    "__Secure-next-auth.session-token",
    "next-auth.session-token",
  ]));

  for (const name of names) {
    for (const suffix of ["", ".0", ".1", ".2"]) {
      // Clear host-only cookies from older deployments. This matters
      // when a browser still has an old ai.thevrschool.org guest cookie
      // plus the newer Domain=.thevrschool.org cookie; either copy can
      // otherwise shadow the fresh Google session during the SSO bridge.
      appendExpiredCookie(res, name + suffix, secure);

      if (domain) {
        appendExpiredCookie(res, name + suffix, secure, domain);
      }
    }
  }
}

function appendExpiredCookie(
  res: NextResponse,
  name: string,
  secure: boolean,
  domain?: string,
) {
  const parts = [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (secure) parts.push("Secure");
  if (domain) parts.push(`Domain=${domain}`);
  res.headers.append("Set-Cookie", parts.join("; "));
}
