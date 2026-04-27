/**
 * POST /api/auth/magic-link/request
 *
 * Public endpoint the /signin form calls to start the magic-link flow.
 * Mints a single-use token via FastAPI, then sends the link by email
 * via Resend. The link points at /signin/magic?token=… on the same
 * deployment; clicking it auto-submits the token to NextAuth's
 * ``magic-link`` CredentialsProvider, which calls the same FastAPI
 * verify route to consume it.
 *
 * Rate limiting lives in FastAPI (per-email, per-hour). On 429 we
 * surface a friendly message rather than the raw error.
 *
 * In dev / preview where ``RESEND_API_KEY`` is missing, the email
 * helper returns ``{provider: "logged"}`` and we surface a hint so
 * the developer can still finish the flow by copying the link from
 * the response (preview-only behaviour, never on prod).
 */

import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { createHash } from "node:crypto";

import { MagicLinkError, requestMagicLink } from "@/lib/auth/magicLink";
import { sendMagicLinkEmail } from "@/lib/auth/email";

export const runtime = "nodejs";

function publicBaseUrl(): string {
  // Prefer NEXTAUTH_URL when set; fall back to the request's own origin
  // (computed on the server at call time below).
  const envUrl = process.env.NEXTAUTH_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  return "";
}

function ipHashFromHeaders(h: Headers): string {
  const raw =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "";
  if (!raw) return "";
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: Request): Promise<Response> {
  let body: { email?: unknown; callbackUrl?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; callbackUrl?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@") || email.length > 200) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  const callbackUrl =
    typeof body.callbackUrl === "string" && body.callbackUrl.startsWith("/")
      ? body.callbackUrl
      : "/welcome";

  const h = await nextHeaders();
  const userAgent = h.get("user-agent") ?? "";
  const ipHash = ipHashFromHeaders(h);
  const origin = publicBaseUrl() || new URL(req.url).origin;

  let token: string;
  let expiresAt: string;
  try {
    const result = await requestMagicLink(email, { ipHash, userAgent });
    token = result.token;
    expiresAt = result.expiresAt;
  } catch (err) {
    if (err instanceof MagicLinkError) {
      if (err.status === 429) {
        return NextResponse.json(
          {
            error:
              "Too many sign-in requests for this email. Please wait a few minutes and try again.",
          },
          { status: 429 },
        );
      }
      if (err.status === 400) {
        return NextResponse.json({ error: err.detail }, { status: 400 });
      }
    }
    return NextResponse.json(
      { error: "Couldn't issue a magic link right now. Please try again." },
      { status: 502 },
    );
  }

  const link = `${origin}/signin/magic?token=${encodeURIComponent(
    token,
  )}&callbackUrl=${encodeURIComponent(callbackUrl)}`;

  const send = await sendMagicLinkEmail({ to: email, link, ttlMinutes: 15 });

  // In production we treat a non-delivery as a hard failure (return 502)
  // so the client never shows "Check your inbox" for an email that
  // never went out. Without this gate, Resend being down silently
  // wastes the user's rate-limit budget on a token they can't see.
  //
  // In dev/preview without a RESEND_API_KEY, the helper falls back to
  // ``provider: "logged"`` and ``delivered: false`` — that is the
  // expected one-click path; the ``previewLink`` lets us auto-follow.
  // We don't 502 in that case.
  const isLoggedFallback = send.provider === "logged";
  if (!send.delivered && !isLoggedFallback) {
    return NextResponse.json(
      {
        error:
          "We couldn't send the sign-in email right now. Please try again in a minute.",
      },
      { status: 502 },
    );
  }

  // We do NOT return the raw token to the client in production — that
  // would be a foot-gun (anyone could read it from devtools). The
  // ``previewLink`` field is gated on NODE_ENV !== "production".
  const safe: {
    ok: true;
    delivered: boolean;
    expiresAt: string;
    previewLink?: string;
  } = {
    ok: true,
    delivered: send.delivered,
    expiresAt,
  };
  if (process.env.NODE_ENV !== "production") {
    safe.previewLink = link;
  }
  return NextResponse.json(safe);
}
