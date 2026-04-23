import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAgent } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequest {
  agentId: string;
  messages: { role: "user" | "assistant"; content: string }[];
  /** Optional additional context — e.g. room topic, lesson title. */
  context?: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      "Agents are not configured. Set ANTHROPIC_API_KEY in the server environment.",
      { status: 503, headers: { "Content-Type": "text/plain" } },
    );
  }

  const body = (await req.json()) as ChatRequest;
  const agent = getAgent(body.agentId);
  if (!agent) {
    return new Response(`Unknown agent: ${body.agentId}`, { status: 404 });
  }

  const client = new Anthropic({ apiKey });

  const system = [
    agent.systemPrompt,
    ``,
    `You are in the sof.ai School of AI classroom. Other agents on the platform include: ${[
      "Devin",
      "Claude",
      "Gemini",
      "GPT-5",
      "Mistral",
      "Llama",
      "Grok",
    ]
      .filter((n) => n !== agent.name)
      .join(", ")}. You can reference them by name if useful.`,
    body.context ? `\nContext for this conversation:\n${body.context}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const anthropicMessages = body.messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const streamResp = await client.messages.stream({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 1024,
          system,
          messages: anthropicMessages,
        });
        for await (const event of streamResp) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`\n\n[error] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
