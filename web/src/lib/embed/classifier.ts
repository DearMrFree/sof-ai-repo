/**
 * Anthropic-backed classifier for embed conversations.
 *
 * The Vercel cron at /api/embed/cron/insights walks the FastAPI
 * pending queue (closed conversations with no insight row), feeds each
 * transcript here, and POSTs the structured output to FastAPI's
 * /embed/insights/upsert. The LLM call lives on the Web side because
 * we already ship Anthropic + an API key here for the chat tool-use
 * loop — adding it to FastAPI would duplicate the dependency surface.
 *
 * The classifier output is deliberately constrained: a fixed set of
 * four insight types so Blajon's training console can render them as
 * a small set of chips, plus a 0–1 signal score so the highest-impact
 * rows float to the top of his backlog.
 */
import Anthropic from "@anthropic-ai/sdk";

export type InsightType =
  | "missed_lead"
  | "capability_gap"
  | "off_brand"
  | "great_save";

export const INSIGHT_TYPES: readonly InsightType[] = [
  "missed_lead",
  "capability_gap",
  "off_brand",
  "great_save",
] as const;

export interface ClassifyInput {
  agent_slug: string;
  conversation_id: number;
  transcript: { role: "user" | "assistant"; content: string }[];
  lead_submitted: boolean;
  lead_error: string | null;
  status: string;
  /** Free-form description of the agent's mission, used to detect off-brand replies. */
  agent_brief: string;
}

export interface ClassifyResult {
  conversation_id: number;
  insight_type: InsightType;
  summary: string;
  signal_score: number;
  suggested_capability: string | null;
  reasoning: string;
  classifier_model: string;
}

const SYSTEM_PROMPT = `You are Devin, the staff classifier for the sof.ai training-data feedback loop. A trainer (e.g. Blajon Lux) ships an embedded AI concierge to their website. Visitors chat with it. Your job is to read each closed conversation and label it with one of FOUR types so the trainer can fix what's leaking revenue or drifting from brand.

Insight types (pick exactly one):

- missed_lead       : Visitor showed real buying intent (asked about a service, mentioned a date, named a job) but the conversation ended without the agent capturing a lead (no name + contact on record). High signal: this directly costs the trainer revenue.
- capability_gap    : Visitor asked about something the agent could not answer crisply — a service tier, a geography, a pricing nuance, an edge case the agent dodged. The seed for a Blajon-proposed capability.
- off_brand         : The agent said something that doesn't match its brief — too casual, over-promised, leaked an internal detail, contradicted itself, or used a tone the trainer would object to.
- great_save        : The agent handled a tricky thread well — multiple services, scheduling juggling, a hesitant visitor, a specialty request — and either closed the lead or set up a strong handoff. Surfaces what to KEEP doing.

Output strict JSON and nothing else:

{
  "insight_type": "missed_lead" | "capability_gap" | "off_brand" | "great_save",
  "summary": "<≤300 chars, plain text, what happened in this chat>",
  "signal_score": <0.0 to 1.0 importance for the trainer's backlog>,
  "suggested_capability": "<≤300 chars proposed addendum to the agent's training context, or null if none>",
  "reasoning": "<≤1000 chars showing your work — what evidence in the transcript drove the call>"
}

Scoring guide:
  - 0.85–1.00 : Clear missed lead with explicit buying intent and unanswered question, OR off-brand reply that materially harms trust.
  - 0.55–0.85 : Material capability gap, multi-turn confusion, or trainer-actionable great save.
  - 0.20–0.55 : Minor friction, stylistic slip, or thin signal.
  - 0.00–0.20 : Information-only chat, junk traffic, no actionable training signal.

Be ruthless about evidence. If the transcript is too short to tell, score low and explain why in reasoning.`;

function transcriptForPrompt(
  transcript: { role: "user" | "assistant"; content: string }[],
): string {
  if (transcript.length === 0) return "(no messages)";
  return transcript
    .map((m, i) => `[${i + 1}] ${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
}

function buildUserMessage(input: ClassifyInput): string {
  return [
    `Agent slug: ${input.agent_slug}`,
    `Agent brief: ${input.agent_brief}`,
    `Conversation status: ${input.status}`,
    `Lead captured: ${input.lead_submitted ? "yes" : "no"}${input.lead_error ? ` (error: ${input.lead_error})` : ""}`,
    "",
    "Transcript:",
    transcriptForPrompt(input.transcript),
    "",
    "Return only the JSON object, no preamble.",
  ].join("\n");
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    if (err.status === 429) return true;
    if (err.status && err.status >= 500) return true;
  }
  return false;
}

function clampScore(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
}

function extractFirstJsonObject(text: string): string | null {
  // The model sometimes wraps the JSON in a fenced block. Strip the
  // fence and trim, then fall back to a brace-balanced scan so a
  // chatty preamble doesn't break the parser.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/m.exec(text);
  const candidate = fenced ? fenced[1].trim() : text.trim();
  if (candidate.startsWith("{") && candidate.endsWith("}")) return candidate;
  // Scan for the first {…} block.
  const start = candidate.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

function parseVerdict(text: string): Omit<ClassifyResult, "conversation_id" | "classifier_model"> {
  const jsonStr = extractFirstJsonObject(text);
  if (!jsonStr) {
    throw new Error("Classifier returned no JSON object.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(
      `Classifier returned malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Classifier verdict must be a JSON object.");
  }
  const o = parsed as Record<string, unknown>;
  const insight_type = String(o.insight_type ?? "");
  if (!INSIGHT_TYPES.includes(insight_type as InsightType)) {
    throw new Error(`Invalid insight_type: ${insight_type}`);
  }
  const summary = String(o.summary ?? "").slice(0, 600);
  const signal_score = clampScore(o.signal_score);
  const suggested_capability_raw = o.suggested_capability;
  const suggested_capability =
    suggested_capability_raw === null ||
    suggested_capability_raw === undefined ||
    String(suggested_capability_raw).trim() === ""
      ? null
      : String(suggested_capability_raw).slice(0, 600);
  const reasoning = String(o.reasoning ?? "").slice(0, 2000);
  return {
    insight_type: insight_type as InsightType,
    summary,
    signal_score,
    suggested_capability,
    reasoning,
  };
}

export async function classifyConversation(
  input: ClassifyInput,
): Promise<ClassifyResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured; insights classifier cannot run.",
    );
  }
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  const userMessage = buildUserMessage(input);

  const delays = [2000, 6000];
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < delays.length + 1; attempt++) {
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });
      const text = resp.content
        .filter((p): p is Anthropic.TextBlock => p.type === "text")
        .map((p) => p.text)
        .join("\n\n")
        .trim();
      if (!text) throw new Error("Empty response from Anthropic.");
      const verdict = parseVerdict(text);
      return {
        conversation_id: input.conversation_id,
        classifier_model: model,
        ...verdict,
      };
    } catch (err) {
      lastErr = err;
      if (attempt >= delays.length || !isRetryable(err)) throw err;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw lastErr;
}

/** Brief for LuxAI1's brand voice — passed into every classification call. */
export const LUXAI1_BRIEF = `LuxAI1 is the AI concierge for All In One (AI1) Bay Area, a luxury home-services business (moving, landscaping, hauling, gutter cleaning, pressure washing) serving Stanford and the Bay Area since 1996. Voice: warm, professional, white-glove. Defers pricing to a 24-hour proposal from Blajon's team rather than quoting on the spot. Captures leads via the submit_lead tool when it has name, contact info, service requested, and an address or ZIP.`;
