import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TutorRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  lessonTitle: string;
  lessonContext: string;
  programTitle: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      "The AI tutor is not configured. Set ANTHROPIC_API_KEY in the server environment to enable it.",
      { status: 503, headers: { "Content-Type": "text/plain" } },
    );
  }

  let body: TutorRequest;
  try {
    body = (await req.json()) as TutorRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const system = [
    `You are the sof.ai AI tutor, embedded in a lesson of the "${body.programTitle}" program.`,
    `The learner is on the lesson: "${body.lessonTitle}".`,
    ``,
    `Here is the current lesson content for context (may be truncated):`,
    `"""`,
    body.lessonContext,
    `"""`,
    ``,
    `Tutoring principles:`,
    `- Be concise. Default to 2–5 sentences.`,
    `- Socratic: prefer asking a clarifying or leading question when the learner is stuck.`,
    `- When explaining, use concrete examples, small code snippets, or analogies.`,
    `- Never dump the whole lesson back at the learner.`,
    `- If asked for the answer to a quiz/exercise, give a hint first and ask if they want the full answer.`,
    `- You know this lesson cold — speak in specifics, not generalities.`,
  ].join("\n");

  const anthropicMessages = body.messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const streamResp = await client.messages.stream({
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
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
        const msg =
          err instanceof Error
            ? err.message
            : "Unknown error talking to Anthropic";
        controller.enqueue(encoder.encode(`\n\n[tutor error] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
