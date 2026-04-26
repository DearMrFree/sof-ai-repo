/**
 * Public anonymous chat endpoint for embedded agents (e.g. LuxAI1 on
 * https://ai1.llc). Handles the Anthropic tool-use loop server-side so
 * the widget never sees raw tool blocks — it just gets the agent's text
 * reply plus a `lead_submitted` flag if a lead was captured.
 *
 * v1 supports a single agent: `luxai1`. The route 404s for other slugs
 * so we can wire more embedded agents (one per sof.ai student) later
 * without leaking surface area.
 *
 * CORS is wide-open (`*`) because this endpoint is meant to be called
 * from arbitrary first-party domains; the widget is a static script
 * that any sof.ai student can drop on their own site.
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import {
  buildSystemPrompt,
  SUBMIT_LEAD_TOOL,
  type SubmitLeadInput,
} from "@/lib/embed/luxai1";
import { notifyBlajon } from "@/lib/embed/lead-email";
import {
  ownerEmailFor,
  shortHash,
  upsertEmbedConversation,
  type EmbedConversationCustomerMeta,
  type EmbedTranscriptMessage,
} from "@/lib/embed/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatBody {
  messages: { role: "user" | "assistant"; content: string }[];
  client_thread_id?: string;
}

/**
 * Lightweight UUID v4 fallback when a client doesn't send a thread id
 * (e.g. an old cached widget version). Newer widgets mint their own
 * id and persist it alongside the thread so we always upsert into the
 * same row, but the server-side fallback keeps every conversation
 * landing in the training-data store regardless.
 */
function uuidV4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function sanitizeThreadId(raw: string | undefined): string {
  if (typeof raw !== "string") return uuidV4();
  const trimmed = raw.trim();
  // Allow UUID hyphens + alphanumerics, cap length at 64 (matches the
  // FastAPI Pydantic constraint). Anything weirder gets replaced.
  if (!/^[A-Za-z0-9_\-]{8,64}$/.test(trimmed)) return uuidV4();
  return trimmed;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(
  body: Record<string, unknown>,
  init: { status?: number } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const MAX_TURNS = 24; // hard ceiling to bound abuse of long sessions
const MAX_CHARS_PER_MESSAGE = 4000;
const MAX_TOOL_HOPS = 3; // submit_lead → result → final reply is 1 hop

function transcriptText(
  msgs: ChatBody["messages"],
  lastAssistant: string,
): string {
  const lines = msgs.map(
    (m) => `${m.role === "user" ? "Visitor" : "LuxAI1"}: ${m.content}`,
  );
  if (lastAssistant) lines.push(`LuxAI1: ${lastAssistant}`);
  return lines.join("\n");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (slug !== "luxai1") {
    return jsonResponse({ error: "unknown_agent" }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      {
        error: "not_configured",
        reply:
          "Sorry — LuxAI1 is offline for a moment. Please call (408) 872-8340 or email luxservicesbayarea@gmail.com and Blajon will get back to you shortly.",
      },
      { status: 503 },
    );
  }

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return jsonResponse({ error: "invalid_json" }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse({ error: "no_messages" }, { status: 400 });
  }
  if (body.messages.length > MAX_TURNS) {
    return jsonResponse(
      {
        error: "too_long",
        reply:
          "This conversation is getting long — please call (408) 872-8340 to continue with a human.",
      },
      { status: 413 },
    );
  }
  for (const m of body.messages) {
    if (
      typeof m?.content !== "string" ||
      (m.role !== "user" && m.role !== "assistant") ||
      m.content.length > MAX_CHARS_PER_MESSAGE
    ) {
      return jsonResponse({ error: "invalid_message" }, { status: 400 });
    }
  }

  const system = await buildSystemPrompt(slug);
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  const userAgent = req.headers.get("user-agent") ?? undefined;

  // Stable per-conversation id so every upsert collapses into one row
  // even if the visitor closes the panel and reopens days later.
  const clientThreadId = sanitizeThreadId(body.client_thread_id);

  // Customer meta: only signal that helps Blajon recognize repeat
  // visitors and lets the insights pipeline group by referrer / source.
  // We hash the IP so the row is non-PII even though the transcript
  // itself contains contact details (which Blajon owns as the lead).
  const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
  const visitorIp = forwardedFor.split(",")[0]?.trim() ?? "";
  const referrer = req.headers.get("referer") ?? undefined;
  const origin = req.headers.get("origin") ?? undefined;
  const customerMeta: EmbedConversationCustomerMeta = {};
  if (userAgent) customerMeta.ua = userAgent.slice(0, 300);
  if (referrer) customerMeta.referrer = referrer.slice(0, 300);
  if (origin) customerMeta.origin = origin.slice(0, 300);
  if (visitorIp) {
    try {
      customerMeta.ip_hash = await shortHash(visitorIp);
    } catch {
      // Web Crypto unavailable in some edge runtimes — skip silently.
    }
  }

  /**
   * Tool-use loop.
   * On each turn: call Anthropic with the conversation so far. If the
   * response contains a `tool_use` block we execute the handler, append
   * a `tool_result` user message, and loop. Else we return the final
   * text reply.
   */
  // Anthropic SDK message shape — block-structured to support tool_use.
  const sdkMessages = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  })) as Parameters<typeof client.messages.create>[0]["messages"];

  let leadSubmitted = false;
  let leadError: string | undefined;
  let finalText = "";

  // The whole tool-use loop runs inside a try/catch so an Anthropic
  // outage (rate limit, overload, transient 5xx, network blip) returns
  // a structured 502 with the same `Access-Control-Allow-Origin: *`
  // headers as the success path. Without this, the exception
  // propagates out of the handler and Next.js emits a bare 500 with
  // NO CORS headers — the cross-origin widget on ai1.llc then sees an
  // opaque CORS failure and shows its generic "I'm offline for a
  // moment" fallback even though the network reached us.
  try {
    for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
    const resp = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      tools: [SUBMIT_LEAD_TOOL] as unknown as Parameters<
        typeof client.messages.create
      >[0]["tools"],
      messages: sdkMessages,
    });

    const toolUses = resp.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const texts = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (toolUses.length === 0 || resp.stop_reason !== "tool_use") {
      finalText = texts;
      break;
    }

    // Append the model's tool_use turn to the running history.
    sdkMessages.push({ role: "assistant", content: resp.content });

    // Execute each tool_use and accumulate tool_result blocks.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      if (tu.name === SUBMIT_LEAD_TOOL.name) {
        const input = tu.input as SubmitLeadInput;
        if (!input?.name || !input?.service) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content:
              "Error: missing required fields. Need at least name and service.",
            is_error: true,
          });
          continue;
        }
        const result = await notifyBlajon(input, {
          transcript: transcriptText(body.messages, texts),
          userAgent,
        });
        if (result.delivered) {
          leadSubmitted = true;
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: `Lead delivered to Blajon. Confirm to the customer that AI1's team will follow up within a few hours. ticket=${result.messageId ?? "logged"}`,
          });
        } else {
          // Logged-only (no API key) is still a "soft success" — the
          // request reached the system; surface that, but don't lie.
          if (result.provider === "logged") {
            leadSubmitted = true;
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content:
                "Lead recorded (preview environment, not yet emailed). Confirm to the customer that AI1's team will follow up.",
            });
          } else {
            leadError = result.error;
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: `Error sending lead: ${result.error ?? "unknown"}. Apologize and offer to take their info another way (call 408-872-8340 or email luxservicesbayarea@gmail.com).`,
              is_error: true,
            });
          }
        }
      } else {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Unknown tool: ${tu.name}`,
          is_error: true,
        });
      }
    }
    sdkMessages.push({ role: "user", content: toolResults });
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[embed/luxai1/chat] anthropic_error", { detail });
    // Persist the conversation even on model error — the visitor's
    // turn(s) and any lead that already fired are real signal that
    // Blajon and the insights pipeline want to see.
    const errorReply = leadSubmitted
      ? "Got your details — Blajon's team will be in touch soon. (My follow-up reply hit a snag, but your request is in.)"
      : "Sorry — I'm having trouble thinking right now. Please call (408) 872-8340 or email luxservicesbayarea@gmail.com and Blajon will help directly.";
    const errorTranscript: EmbedTranscriptMessage[] = [
      ...body.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "assistant" as const, content: errorReply },
    ];
    await upsertEmbedConversation({
      agent_slug: slug,
      client_thread_id: clientThreadId,
      owner_email: ownerEmailFor(slug),
      transcript: errorTranscript,
      customer_meta: customerMeta,
      lead_submitted: leadSubmitted,
      lead_error: leadError ?? `model_error: ${detail.slice(0, 300)}`,
    });
    // Preserve `leadSubmitted` from any earlier successful tool hop —
    // the email to Blajon already went out, so the widget must show
    // its "sent" pill even though the *follow-up* model turn failed.
    // Hardcoding `false` here would cause the user to retry, double-
    // submitting Blajon's inbox.
    return jsonResponse(
      {
        error: "model_error",
        reply: errorReply,
        lead_submitted: leadSubmitted,
        lead_error: leadError,
        client_thread_id: clientThreadId,
      },
      { status: 502 },
    );
  }

  if (!finalText) {
    finalText =
      "Sorry — I had trouble responding. Please call (408) 872-8340 and Blajon's team will help directly.";
  }

  // Persist the conversation as training data. Done after we've already
  // built the user-facing reply so a slow FastAPI doesn't block the
  // visitor; bounded by a 2.5s timeout inside upsertEmbedConversation.
  // Failures are logged but never surfaced to the widget.
  const persistedTranscript: EmbedTranscriptMessage[] = [
    ...body.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "assistant" as const, content: finalText },
  ];
  await upsertEmbedConversation({
    agent_slug: slug,
    client_thread_id: clientThreadId,
    owner_email: ownerEmailFor(slug),
    transcript: persistedTranscript,
    customer_meta: customerMeta,
    lead_submitted: leadSubmitted,
    lead_error: leadError,
  });

  return jsonResponse({
    reply: finalText,
    lead_submitted: leadSubmitted,
    lead_error: leadError,
    client_thread_id: clientThreadId,
  });
}
