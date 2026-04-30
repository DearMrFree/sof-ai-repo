/**
 * Cross-TLD SSO bridge tokens.
 *
 * `sof.ai` and `*.thevrschool.org` are different top-level domains, so a
 * NextAuth session cookie can't be shared across them — browsers refuse.
 * Instead, the canonical auth surface (`ai.thevrschool.org`) mints a
 * short-lived signed token, the visitor follows a 302 to the sister
 * site, and the sister site verifies the token + sets its own cookie.
 *
 * The token is a tiny custom JWT-like envelope:
 *
 *   <base64url(JSON payload)>.<base64url(HMAC-SHA256(payload, secret))>
 *
 * Payload fields:
 *   iss     — issuer URL (always the canonical auth surface)
 *   aud     — audience host (must match the sister-site recipient)
 *   sub     — email of the authenticated user
 *   name    — display name (best-effort, falls back to email local part)
 *   image   — optional avatar URL
 *   iat/exp — issue + expiry timestamps in seconds since epoch
 *   jti     — random per-token id (defends against replay if the
 *             receiving side bothers to track consumed jtis)
 *
 * NOT a real JWT — no header, no `alg` field — because we don't need
 * format flexibility and this keeps the dependency footprint to zero
 * beyond `node:crypto`.
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export interface BridgePayload {
  iss: string;
  aud: string;
  sub: string;
  name: string;
  image: string | null;
  iat: number;
  exp: number;
  jti: string;
}

const DEFAULT_TTL_SECONDS = 60;

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to mint SSO bridge tokens");
  }
  return secret;
}

export interface MintBridgeTokenInput {
  iss: string;
  aud: string;
  sub: string;
  name: string;
  image?: string | null;
  ttlSeconds?: number;
}

/** Mint a fresh signed bridge token. Throws if NEXTAUTH_SECRET is unset. */
export function mintBridgeToken(input: MintBridgeTokenInput): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: BridgePayload = {
    iss: input.iss,
    aud: input.aud,
    sub: input.sub.trim().toLowerCase(),
    name: input.name,
    image: input.image ?? null,
    iat: now,
    exp: now + (input.ttlSeconds ?? DEFAULT_TTL_SECONDS),
    jti: randomUUID(),
  };
  const json = JSON.stringify(payload);
  const payloadB64 = b64urlEncode(Buffer.from(json, "utf8"));
  const sig = createHmac("sha256", getSecret()).update(payloadB64).digest();
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

export type VerifyBridgeResult =
  | { ok: true; payload: BridgePayload }
  | { ok: false; error: string };

/**
 * Verify a bridge token: signature, expiry, and audience.
 *
 * Pass the expected `aud` so a token minted for `sof.ai` can't be
 * replayed against (e.g.) `www.thevrschool.org`. Hosts are compared
 * case-insensitively.
 */
export function verifyBridgeToken(
  token: string,
  expectedAud: string,
): VerifyBridgeResult {
  if (!token || token.indexOf(".") < 0) {
    return { ok: false, error: "malformed token" };
  }
  const [payloadB64, sigB64] = token.split(".", 2);
  if (!payloadB64 || !sigB64) {
    return { ok: false, error: "malformed token" };
  }

  let secret: string;
  try {
    secret = getSecret();
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const expected = createHmac("sha256", secret).update(payloadB64).digest();
  let actual: Buffer;
  try {
    actual = b64urlDecode(sigB64);
  } catch {
    return { ok: false, error: "malformed signature" };
  }
  if (
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  ) {
    return { ok: false, error: "bad signature" };
  }

  let payload: BridgePayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch {
    return { ok: false, error: "malformed payload" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) {
    return { ok: false, error: "token expired" };
  }
  if (
    typeof payload.aud !== "string" ||
    payload.aud.toLowerCase() !== expectedAud.toLowerCase()
  ) {
    return { ok: false, error: "audience mismatch" };
  }
  if (typeof payload.sub !== "string" || !payload.sub.includes("@")) {
    return { ok: false, error: "invalid subject" };
  }
  return { ok: true, payload };
}
