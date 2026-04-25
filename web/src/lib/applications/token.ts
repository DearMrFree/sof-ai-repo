/**
 * HMAC-signed reviewer tokens for the agent-onboarding trio.
 *
 * Each of the three steering reviewers (Freedom, Garth Corea at APA,
 * Esther Wojcicki) gets a one-link-per-application URL emailed to them.
 * Token shape: `b64url(payload).hmac_sha256(payload)` where the payload
 * is JSON-encoded so user-supplied fields (the email) can never collide
 * with a structural delimiter.
 *
 * Signing key: `APPLICATIONS_REVIEW_SECRET` (or `NEXTAUTH_SECRET` as a
 * sane default so the feature works on day-one without a fresh env var).
 *
 * Tokens are not single-use at the wire level — the underlying API route
 * upserts on (application_id, reviewer_email), so a reviewer who clicks
 * the link twice and changes their mind is supported. Tokens DO expire
 * after 30 days as a backstop.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface ReviewToken {
  applicationId: number;
  reviewerEmail: string;
  issuedAt: number; // epoch seconds
}

const TOKEN_VERSION = "v1";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret =
    process.env.APPLICATIONS_REVIEW_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "";
  if (!secret) {
    throw new Error(
      "APPLICATIONS_REVIEW_SECRET or NEXTAUTH_SECRET must be set to mint reviewer tokens.",
    );
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", getSecret()).update(payload).digest());
}

interface TokenPayload {
  v: string;
  id: number;
  email: string;
  iat: number;
}

/**
 * Mint a token an emailed reviewer can use to access the review page.
 *
 * The payload is JSON-encoded inside the b64url segment so the email
 * address — which contains dots in every real case — can't collide
 * with any structural delimiter.
 */
export function signReviewToken(
  applicationId: number,
  reviewerEmail: string,
): string {
  const payload: TokenPayload = {
    v: TOKEN_VERSION,
    id: applicationId,
    email: reviewerEmail.toLowerCase(),
    iat: Math.floor(Date.now() / 1000),
  };
  const encoded = b64url(JSON.stringify(payload));
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

/**
 * Verify a token from the URL and return its claims, or `null` if the
 * signature is invalid or the token is expired. Constant-time comparison
 * is used on the signature.
 */
export function verifyReviewToken(token: string): ReviewToken | null {
  if (!token || token.length > 4096) return null;
  // Single dot separates payload from signature. The payload is now
  // JSON inside b64url, so dots inside emails never reach this split.
  const sepIndex = token.lastIndexOf(".");
  if (sepIndex <= 0 || sepIndex >= token.length - 1) return null;
  const payloadB64 = token.slice(0, sepIndex);
  const sig = token.slice(sepIndex + 1);

  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let parsed: TokenPayload;
  try {
    parsed = JSON.parse(fromB64url(payloadB64).toString("utf-8")) as TokenPayload;
  } catch {
    return null;
  }
  if (parsed.v !== TOKEN_VERSION) return null;
  if (typeof parsed.email !== "string" || parsed.email.length === 0) return null;
  if (!Number.isInteger(parsed.id) || parsed.id <= 0) return null;
  if (!Number.isInteger(parsed.iat)) return null;
  if (Math.floor(Date.now() / 1000) - parsed.iat > MAX_AGE_SECONDS) return null;

  return {
    applicationId: parsed.id,
    reviewerEmail: parsed.email,
    issuedAt: parsed.iat,
  };
}
