/**
 * HMAC-signed reviewer tokens for the agent-onboarding trio.
 *
 * Each of the three steering reviewers (Freedom, Garth Corea at APA,
 * Esther Wojcicki) gets a one-link-per-application URL emailed to them.
 * The token in the URL is `b64url(reviewer_email):b64url(application_id)`
 * with an HMAC-SHA256 signature appended; the signing key is
 * `APPLICATIONS_REVIEW_SECRET` (or `NEXTAUTH_SECRET` as a sane default
 * so the feature works on day-one without a fresh env var).
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

/**
 * Mint a token an emailed reviewer can use to access the review page.
 */
export function signReviewToken(
  applicationId: number,
  reviewerEmail: string,
): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${TOKEN_VERSION}.${applicationId}.${reviewerEmail.toLowerCase()}.${issuedAt}`;
  const sig = sign(payload);
  return `${b64url(payload)}.${sig}`;
}

/**
 * Verify a token from the URL and return its claims, or `null` if the
 * signature is invalid or the token is expired. Constant-time comparison
 * is used on the signature.
 */
export function verifyReviewToken(token: string): ReviewToken | null {
  if (!token || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  let payload: string;
  try {
    payload = fromB64url(payloadB64).toString("utf-8");
  } catch {
    return null;
  }
  const expected = sign(payload);
  // timingSafeEqual requires equal-length buffers; pad / fall back if they
  // differ so we don't leak length via short-circuit.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const segments = payload.split(".");
  if (segments.length !== 4 || segments[0] !== TOKEN_VERSION) return null;
  const applicationId = Number(segments[1]);
  const reviewerEmail = segments[2];
  const issuedAt = Number(segments[3]);
  if (
    !Number.isInteger(applicationId) ||
    applicationId <= 0 ||
    !Number.isInteger(issuedAt)
  ) {
    return null;
  }
  if (Math.floor(Date.now() / 1000) - issuedAt > MAX_AGE_SECONDS) {
    return null;
  }
  return { applicationId, reviewerEmail, issuedAt };
}
