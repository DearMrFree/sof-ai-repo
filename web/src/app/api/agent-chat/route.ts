import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AGENTS, getAgent, findAgentWithCapability, agentHasCapability } from "@/lib/agents";
import {
  chatStream,
  agentProviderToLLM,
  isProviderConfigured,
  type ChatMessage,
} from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequest {
  agentId: string;
  messages: { role: "user" | "assistant"; content: string }[];
  /** Optional additional context — e.g. room topic, lesson title. */
  context?: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Sign in to chat with agents.", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // At least one LLM provider must be configured.
  const hasAny =
    !!process.env.ANTHROPIC_API_KEY ||
    !!process.env.OPENAI_API_KEY ||
    !!process.env.PERPLEXITY_API_KEY ||
    !!process.env.DEEPSEEK_API_KEY;
  if (!hasAny) {
    return new Response(
      "No LLM providers are configured. Set at least one API key (ANTHROPIC_API_KEY, OPENAI_API_KEY, PERPLEXITY_API_KEY, or DEEPSEEK_API_KEY) in the server environment.",
      { status: 503, headers: { "Content-Type": "text/plain" } },
    );
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const agent = getAgent(body.agentId);
  if (!agent) {
    return new Response(`Unknown agent: ${body.agentId}`, { status: 404 });
  }

  // Determine which LLM provider to use. Prefer the agent's native provider
  // when its API key is configured; otherwise fall back to Anthropic (Claude
  // proxies the persona via the system prompt).
  const nativeProvider = agentProviderToLLM(agent.provider);
  const provider = isProviderConfigured(nativeProvider)
    ? nativeProvider
    : "anthropic";

  // Office-hours referrals: tell the agent who's on duty for which job
  // so it can recommend a hand-off instead of half-attempting work that
  // a specialist agent would handle better.
  const fileAgent = findAgentWithCapability("file_analysis");
  const devinAgent = findAgentWithCapability("devin_kickoff");
  const referrals: string[] = [];
  if (fileAgent && fileAgent.id !== agent.id) {
    referrals.push(
      `${fileAgent.name} is on duty for **file analysis** during office hours. If the learner shares a large file (PDF, dataset, transcript, codebase) or asks for a thorough read, recommend a hand-off by emitting on its own line: \`<HANDOFF target="${fileAgent.id}" reason="file-analysis">one-sentence reason</HANDOFF>\`. The classroom turns that token into a one-click button.`,
    );
  }
  if (devinAgent && devinAgent.id !== agent.id) {
    referrals.push(
      `${devinAgent.name} is on duty for **shipping code** during office hours \u2014 building, refactoring, opening PRs. If the learner asks you to write production code, ship a feature, or debug a real repo, recommend a hand-off by emitting on its own line: \`<HANDOFF target="${devinAgent.id}" reason="ship-code">one-sentence reason</HANDOFF>\`.`,
    );
  }
  // Self-capability hints, so e.g. Claude knows the upload zone exists.
  const selfCaps: string[] = [];
  if (agentHasCapability(agent, "file_analysis")) {
    selfCaps.push(
      "You have an upload zone in this thread. If the learner mentions a file they want analyzed, encourage them to drop it in (the UI element labelled \"Drop a file\\u2026\").",
    );
  }
  if (agentHasCapability(agent, "devin_kickoff")) {
    selfCaps.push(
      "There's a \"Start a Devin session\" button right above the chat box. When the learner asks for code shipped, point them at it.",
    );
  }

  const agentNames = AGENTS.map((a) => a.name)
    .filter((n) => n !== agent.name);

  const system = [
    agent.systemPrompt,
    `\nYou are in the sof.ai School of AI classroom. Other agents on the platform include: ${agentNames.join(", ")}. You can reference them by name if useful.`,
    referrals.length > 0
      ? `\n**Office-hours referrals.**\n- ${referrals.join("\n- ")}`
      : "",
    selfCaps.length > 0 ? `\n**Your office-hours actions.**\n- ${selfCaps.join("\n- ")}` : "",
    body.context ? `\nContext for this conversation:\n${body.context}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Build the message array for the LLM. Filter empty and normalize roles.
  const llmMessages: ChatMessage[] = (body.messages ?? [])
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));
  if (llmMessages.length === 0 || llmMessages[0].role !== "user") {
    // Ensure the first message is from the user (strip leading assistant).
    const firstUser = llmMessages.findIndex((m) => m.role === "user");
    if (firstUser < 0) {
      return new Response("No user messages provided.", { status: 400 });
    }
    llmMessages.splice(0, firstUser);
  }

  // Merge consecutive same-role messages (same sanitization as
  // lib/anthropicMessages.ts but works for all providers).
  const merged: ChatMessage[] = [];
  for (const m of llmMessages) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content}\n${m.content}`;
    } else {
      merged.push({ role: m.role, content: m.content });
    }
  }

  try {
    const stream = chatStream({
      provider,
      system,
      messages: merged,
      maxTokens: 1024,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(`[error] ${msg}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
