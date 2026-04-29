/**
 * GET /api/auth/sso/handoff
 *
 * Cross-TLD SSO handoff. ``ai.thevrschool.org`` is the canonical auth
 * surface for the School of Freedom ecosystem; sister sites on other
 * TLDs (today: ``sof.ai``) defer all sign-in to here, then receive a
 * short-lived signed bridge token that lets them mint their own local
 * NextAuth session cookie.
 *
 * Query string:
 *   ?domain=sof.ai          (required; must be in TRUSTED_SISTER_HOSTS)
 *   &next=/some/path        (optional; relative path on the sister site)
 *
 * Behaviour:
 *   1. If the visitor is already signed in here, mint a 60s bridge
 *      token (``aud=<domain>``, ``sub=<email>``) signed with the shared
 *      NEXTAUTH_SECRET, then 302 to
 *      ``https://<domain>/api/auth/sso/finish?token=...&next=...``.
 *   2. If not signed in, 302 to this app's ``/signin`` with a
 *      ``callbackUrl`` pointing back at this same handoff endpoint —
 *      so after sign-in the visitor lands here again and gets the
 *      token automatically.
 *
 * Guests (``*@guest.sof.ai``) are not bridged: their identity is
 * intentionally ephemeral + scoped to the domain that minted them.
 * They get a 400 so the sister site can show the user a clear "sign
 * in with a real email to use SSO" message.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { mintBridgeToken } from "@/lib/sso/bridgeToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only these hosts may receive a bridge token. Adding a sister site
// later means listing the host here AND deploying a matching
// ``/api/auth/sso/finish`` route on that side.
const TRUSTED_SISTER_HOSTS = new Set([
  "sof.ai",
  "www.sof.ai",
  // Localhost for end-to-end testing of the sister site against this
  // canonical surface. Strict port-match keeps it safe; arbitrary
  // localhost ports won't resolve.
  "localhost:3000",
  "localhost:3001",
]);

function safeRelativeNext(raw: string | null): string {
  // Only accept a relative path on the sister site. Anything else
  // (absolute URLs, ``//evil.com``, schemes) becomes ``/``.
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  // Strip control chars + CR/LF that could be smuggled into headers.
  if (/[\u0000-\u001f]/.test(raw)) return "/";
  return raw;
}

function canonicalIssuer(req: NextRequest): string {
  // Honour NEXTAUTH_URL when set (production); fall back to the
  // request's own origin so previews and local dev still work.
  const fromEnv = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return new URL(req.url).origin;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const domain = (url.searchParams.get("domain") ?? "").toLowerCase().trim();
  const next = safeRelativeNext(url.searchParams.get("next"));

  if (!domain || !TRUSTED_SISTER_HOSTS.has(domain)) {
    return NextResponse.json(
      { error: "untrusted or missing domain" },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? "").trim().toLowerCase();

  if (!email) {
    // Round-trip back here after sign-in so we mint the token on the
    // second visit. Encoding the same handoff URL as ``callbackUrl``
    // is intentional — that's the only param /signin honours and it
    // keeps the round-trip transparent.
    const back = new URL("/api/auth/sso/handoff", req.url);
    back.searchParams.set("domain", domain);
    if (next !== "/") back.searchParams.set("next", next);
    const signin = new URL("/signin", req.url);
    signin.searchParams.set("callbackUrl", back.toString());
    return NextResponse.redirect(signin);
  }

  if (email.endsWith("@guest.sof.ai")) {
    // Don't extend ephemeral guest identities across TLDs. The sister
    // site can render a clearer prompt than NextAuth's default error.
    return NextResponse.json(
      { error: "guest identity not bridgeable; sign in with a real email" },
      { status: 400 },
    );
  }

  let token: string;
  try {
    token = mintBridgeToken({
      iss: canonicalIssuer(req),
      aud: domain,
      sub: email,
      name: session?.user?.name ?? "",
      image: session?.user?.image ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "could not mint bridge token", detail: String(err) },
      { status: 500 },
    );
  }

  // Localhost dev keeps http; everything else gets https. The trusted
  // host set above is what stops ``http://evil.com`` ever reaching here.
  const scheme = domain.startsWith("localhost") ? "http" : "https";
  const finish = new URL(`${scheme}://${domain}/api/auth/sso/finish`);
  finish.searchParams.set("token", token);
  if (next !== "/") finish.searchParams.set("next", next);

  return NextResponse.redirect(finish.toString());
}
