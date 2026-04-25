import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ALL_TOOLS, fromWireName, getTool, toWireName } from "@/lib/cowork/tools";
import { signCall } from "@/lib/cowork/auth";
import type { CoworkPlan, CoworkToolCall } from "@/lib/cowork/types";
import { sanitizeForAnthropic } from "@/lib/anthropicMessages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PlanRequest {
  agentId: string;
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

const SYSTEM_PROMPT =
  "You are Claude in cowork mode on sof.ai. The learner has authorised you to perform real, mutating infrastructure actions on their behalf, but ONLY after they click \"Grant\" on each individual action. " +
  "When the learner asks for an action, choose the smallest set of tool calls that accomplishes it (often one). " +
  "Reply with a one-line plain-text plan first, then call the tool. Do NOT claim to have done anything — execution happens only after the human clicks Grant. " +
  "If the request is ambiguous (e.g. an unspecified store name), ask for clarification in plain text and DON'T call a tool. " +
  "Keep replies under 60 words.";

function userIdOf(session: { user?: { id?: unknown; email?: string | null } } | null): string {
  const u = session?.user;
  if (!u) return "anon";
  if (typeof (u as { id?: unknown }).id === "string") {
    return (u as { id: string }).id;
  }
  return u.email ?? "anon";
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: "Sign in to use cowork." },
      { status: 401 },
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Cowork is not configured. ANTHROPIC_API_KEY is unset." },
      { status: 503 },
    );
  }
  if (!process.env.VERCEL_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Cowork is not configured. VERCEL_TOKEN is unset on the server, so Vercel actions cannot be planned.",
      },
      { status: 503 },
    );
  }

  let body: PlanRequest;
  try {
    body = (await req.json()) as PlanRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const tools = ALL_TOOLS.map((t) => ({
    name: toWireName(t.id),
    description: t.description,
    input_schema: {
      type: "object" as const,
      properties: Object.fromEntries(
        t.params.map((p) => [
          p.name,
          { type: p.type, description: p.description },
        ]),
      ),
      required: t.params.filter((p) => p.required).map((p) => p.name),
    },
  }));

  const messages = sanitizeForAnthropic([
    ...(body.history ?? []),
    { role: "user", content: body.message },
  ]);
  if (messages.length === 0) {
    return NextResponse.json(
      { error: "No user messages provided." },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let resp;
  try {
    resp = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Planner failed." },
      { status: 502 },
    );
  }

  const userId = userIdOf(session);
  let reasoning = "";
  const toolCalls: CoworkToolCall[] = [];
  for (const block of resp.content) {
    if (block.type === "text") {
      reasoning += block.text;
    } else if (block.type === "tool_use") {
      const toolId = fromWireName(block.name);
      const tool = getTool(toolId);
      if (!tool) continue;
      const params = (block.input ?? {}) as Record<string, unknown>;
      const callId = signCall({ toolId, params, userId });
      toolCalls.push({
        callId,
        toolId,
        params,
        preview: tool.preview(params),
        mutating: tool.mutating,
      });
    }
  }

  const plan: CoworkPlan = { reasoning: reasoning.trim(), toolCalls };
  return NextResponse.json(plan);
}
