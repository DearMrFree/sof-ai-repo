import crypto from "crypto";

/**
 * HMAC-signed approval tokens.
 *
 * The plan endpoint mints a token per proposed tool call; the execute
 * endpoint verifies it. The signature binds the token to: the exact
 * tool, the exact params, the user that asked for it, and an
 * expiration. A user can't escalate a benign read-only call into a
 * mutation, can't tamper with the params, and can't replay another
 * user's approval — every change to any of those fields invalidates
 * the signature.
 */

const SECRET =
  process.env.COWORK_SIGNING_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "dev-cowork-secret-do-not-use-in-prod";

/** Approval window — short, since the user is staring at the card. */
const TTL_MS = 5 * 60 * 1000;

export interface CallPayload {
  toolId: string;
  params: Record<string, unknown>;
  userId: string;
  /** Unix ms epoch after which the token is invalid. */
  exp: number;
}

export function signCall(
  payload: Omit<CallPayload, "exp"> & { exp?: number },
): string {
  const full: CallPayload = { ...payload, exp: payload.exp ?? Date.now() + TTL_MS };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyCall(token: string): CallPayload {
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("Malformed cowork token.");
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (
    expectedBuf.length !== sigBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, sigBuf)
  ) {
    throw new Error("Invalid cowork token signature.");
  }
  let payload: CallPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString()) as CallPayload;
  } catch {
    throw new Error("Malformed cowork token payload.");
  }
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
    throw new Error("Cowork approval token expired.");
  }
  return payload;
}
