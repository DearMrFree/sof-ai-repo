/**
 * Vercel Cron: daily classification sweep for embed conversations.
 *
 * Schedule: defined in /web/vercel.json — once per day at 09:00 UTC,
 * a few hours after the abandon-stale cron has had time to flip
 * long-idle conversations to ``abandoned`` so they're eligible.
 *
 * Flow per slug:
 *   1. Pull the pending queue from FastAPI: closed (or quiet >5 min)
 *      conversations with no insight row yet.
 *   2. For each row, run the Anthropic classifier with the agent's
 *      brief baked into the system prompt.
 *   3. Upsert the structured result back to FastAPI.
 *
 * The cron is bounded — it caps the per-run batch so a backlog
 * doesn't blow through the 300s Vercel function budget. Anything left
 * over is picked up tomorrow.
 *
 * Auth: same shape as the application auto-renew cron — `Bearer
 * ${CRON_SECRET}` from Vercel Cron OR `X-Internal-Auth` for manual ops.
 */
import { NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/apiBase";
import { LUXAI1_BRIEF, classifyConversation } from "@/lib/embed/classifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Slugs the cron knows how to classify, with their brand briefs. */
const AGENT_BRIEFS: Record<string, string> = {
  luxai1: LUXAI1_BRIEF,
};

/** Per-slug cap so one slug's backlog can't starve another's. */
const PER_SLUG_LIMIT = 25;

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  const internal = process.env.INTERNAL_API_KEY;
  if (internal && req.headers.get("x-internal-auth") === internal) return true;
  return false;
}

function internalHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.INTERNAL_API_KEY) {
    h["X-Internal-Auth"] = process.env.INTERNAL_API_KEY;
  }
  return h;
}

interface PendingItem {
  conversation: {
    id: number;
    agent_slug: string;
    transcript: { role: "user" | "assistant"; content: string }[];
    lead_submitted: boolean;
    lead_error: string | null;
    status: string;
  };
}

interface SlugResult {
  slug: string;
  pending: number;
  classified: number;
  failed: number;
  errors: { conversation_id: number; error: string }[];
}

async function classifySlug(slug: string, brief: string): Promise<SlugResult> {
  const result: SlugResult = {
    slug,
    pending: 0,
    classified: 0,
    failed: 0,
    errors: [],
  };

  // 1. Pull the work queue.
  const pendingUrl = new URL(
    `${getApiBaseUrl()}/embed/${slug}/insights/pending`,
  );
  pendingUrl.searchParams.set("limit", String(PER_SLUG_LIMIT));
  const pendingRes = await fetch(pendingUrl.toString(), {
    headers: internalHeaders(),
    cache: "no-store",
  });
  if (!pendingRes.ok) {
    result.errors.push({
      conversation_id: 0,
      error: `pending_queue_${pendingRes.status}`,
    });
    return result;
  }
  const pendingPayload = (await pendingRes.json()) as {
    items: PendingItem[];
    total: number;
  };
  result.pending = pendingPayload.total;

  // 2. Classify and upsert each row, sequentially. Anthropic rate
  // limits + the small batch size make parallelism not worth the
  // failure-mode complexity here.
  for (const item of pendingPayload.items) {
    const c = item.conversation;
    try {
      const verdict = await classifyConversation({
        agent_slug: c.agent_slug,
        conversation_id: c.id,
        transcript: c.transcript,
        lead_submitted: c.lead_submitted,
        lead_error: c.lead_error,
        status: c.status,
        agent_brief: brief,
      });
      const upsertRes = await fetch(
        `${getApiBaseUrl()}/embed/insights/upsert`,
        {
          method: "POST",
          headers: internalHeaders(),
          body: JSON.stringify(verdict),
          cache: "no-store",
        },
      );
      if (!upsertRes.ok) {
        result.failed += 1;
        result.errors.push({
          conversation_id: c.id,
          error: `upsert_${upsertRes.status}`,
        });
        continue;
      }
      result.classified += 1;
    } catch (err) {
      result.failed += 1;
      result.errors.push({
        conversation_id: c.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

async function runCron(): Promise<NextResponse> {
  const summary: { slugs: SlugResult[]; total_classified: number } = {
    slugs: [],
    total_classified: 0,
  };
  for (const [slug, brief] of Object.entries(AGENT_BRIEFS)) {
    const res = await classifySlug(slug, brief);
    summary.slugs.push(res);
    summary.total_classified += res.classified;
  }
  return NextResponse.json(summary);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runCron();
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runCron();
}
