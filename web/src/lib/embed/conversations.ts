/**
 * Helpers for persisting embed-agent conversations to FastAPI.
 *
 * The chat route calls ``upsertEmbedConversation`` after every turn so
 * Blajon's training console at /embed/luxai1/conversations always
 * shows what visitors have been asking LuxAI1. Failures here are
 * logged but never bubble up to the visitor — the conversation
 * still completes; we just lose the training-data row, which the
 * insights cron can no longer classify. That tradeoff is intentional:
 * better to drop a row than to break a customer's chat.
 */
import { getApiBaseUrl } from "@/lib/apiBase";

export interface EmbedTranscriptMessage {
  role: "user" | "assistant";
  content: string;
}

export interface EmbedConversationCustomerMeta {
  ua?: string;
  referrer?: string;
  ip_hash?: string;
  origin?: string;
}

export interface UpsertEmbedConversationInput {
  agent_slug: string;
  client_thread_id: string;
  owner_email: string;
  transcript: EmbedTranscriptMessage[];
  customer_meta?: EmbedConversationCustomerMeta;
  lead_submitted?: boolean;
  lead_resend_message_id?: string;
  lead_error?: string;
  status?: "active" | "converted" | "abandoned";
}

const UPSERT_TIMEOUT_MS = 2500;

function internalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    headers["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  return headers;
}

/**
 * Best-effort upsert. Returns true on success, false on any failure.
 * The caller must NOT block its response on this — wrap in
 * ``Promise.race`` against a timeout if you need to bound latency.
 */
export async function upsertEmbedConversation(
  payload: UpsertEmbedConversationInput,
): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPSERT_TIMEOUT_MS);
    const res = await fetch(
      `${getApiBaseUrl()}/embed/conversations/upsert`,
      {
        method: "POST",
        headers: internalHeaders(),
        body: JSON.stringify(payload),
        signal: ctrl.signal,
        cache: "no-store",
      },
    );
    clearTimeout(timer);
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn("[embed/conversations] upsert non-2xx", {
        status: res.status,
        slug: payload.agent_slug,
      });
      return false;
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[embed/conversations] upsert failed", {
      detail: err instanceof Error ? err.message : String(err),
      slug: payload.agent_slug,
    });
    return false;
  }
}

/**
 * Hash a value (e.g. an IP) into a short hex digest for the
 * ``customer_meta`` blob. Avoids storing raw IPs while still letting
 * Blajon recognize repeat visitors. Web Crypto SHA-256, first 16 hex
 * chars — collision-resistant enough for visitor de-dup at this scale.
 */
export async function shortHash(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 16);
}

/** Owner registry: which email owns each agent slug. */
const AGENT_OWNERS: Record<string, string> = {
  luxai1: "luxservicesbayarea@gmail.com",
};

export function ownerEmailFor(slug: string): string {
  return AGENT_OWNERS[slug] ?? "";
}

/**
 * Lead-professor + owner allowlist for viewing an agent's transcripts.
 * The trainer ↔ professor relationship is the same one captured in the
 * StudentEnrollment row; we keep a small parallel copy here so the
 * Web UI doesn't need a backend round-trip just to gate the page.
 */
const AGENT_VIEWERS: Record<string, string[]> = {
  luxai1: [
    "luxservicesbayarea@gmail.com",
    "freedom@thevrschool.org",
    "devin@sof.ai",
  ],
};

export function canViewAgent(slug: string, email: string): boolean {
  const norm = email.trim().toLowerCase();
  if (!norm) return false;
  const allow = AGENT_VIEWERS[slug] ?? [];
  return allow.includes(norm);
}
