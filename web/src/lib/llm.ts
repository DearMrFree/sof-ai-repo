/**
 * Multi-provider LLM client.
 *
 * sof.ai talks to multiple LLM providers (currently Anthropic's Claude family
 * for tutor/agent/room/lesson chat, and DeepSeek for reasoning-heavy tasks
 * like auto-grading and step-by-step math/debugging). This module is the
 * single server-side abstraction every feature should call into — provider
 * selection, auth, retries, and reasoning-content handling live here, so the
 * rest of the app is provider-agnostic.
 *
 *   import { chatJSON, chatStream } from "@/lib/llm";
 *
 * Selection order for the provider:
 *   1. Explicit `provider:` argument on the call.
 *   2. `LLM_PROVIDER` env var ("anthropic" | "deepseek").
 *   3. Fallback to whichever provider has its API key configured.
 *   4. Throw if neither is configured.
 */

import Anthropic from "@anthropic-ai/sdk";
import { sanitizeForAnthropic } from "@/lib/anthropicMessages";

export type ProviderName = "anthropic" | "deepseek" | "openai" | "perplexity";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  provider?: ProviderName;
  /** Override the default model for the chosen provider. */
  model?: string;
  /** Optional system prompt (merged with any "system" messages in input). */
  system?: string;
  messages: ChatMessage[];
  /** Max tokens to emit. */
  maxTokens?: number;
  /** Lower = more deterministic. Providers may clamp. */
  temperature?: number;
  /**
   * Ask the provider to surface its reasoning (DeepSeek `deepseek-reasoner`
   * populates `reasoning_content`; Anthropic's extended-thinking models
   * similarly expose thinking blocks). Non-reasoning models ignore this.
   */
  reasoning?: boolean;
}

export interface ChatResult {
  /** The model's final user-facing answer. */
  content: string;
  /** Step-by-step reasoning if the provider/model produced any. */
  reasoning?: string;
  /** Which provider actually served the request. */
  provider: ProviderName;
  /** Which model actually served the request. */
  model: string;
}

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

const VALID_PROVIDERS: ProviderName[] = ["anthropic", "deepseek", "openai", "perplexity"];

function pickProvider(explicit?: ProviderName): ProviderName {
  if (explicit) return explicit;
  const envChoice = process.env.LLM_PROVIDER?.toLowerCase();
  if (VALID_PROVIDERS.includes(envChoice as ProviderName))
    return envChoice as ProviderName;

  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  if (hasAnthropic) return "anthropic";
  if (hasDeepSeek) return "deepseek";
  return "anthropic";
}

const ENV_KEY_MAP: Record<ProviderName, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  openai: "OPENAI_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

export class LLMNotConfiguredError extends Error {
  constructor(provider: ProviderName) {
    super(
      `The ${provider} LLM provider is not configured. Set ${ENV_KEY_MAP[provider]} in the server environment to enable it.`,
    );
    this.name = "LLMNotConfiguredError";
  }
}

// ---------------------------------------------------------------------------
// Anthropic — non-streaming JSON + streaming text
// ---------------------------------------------------------------------------

function anthropicModel(opts: ChatOptions): string {
  return opts.model ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
}

function splitSystem(
  opts: ChatOptions,
): { system: string; messages: ChatMessage[] } {
  // Merge any leading "system" role entries with an explicit opts.system into
  // one string. Providers differ — Anthropic wants `system` as a top-level
  // parameter; OpenAI-compatible treats it as the first message.
  const systems: string[] = [];
  if (opts.system) systems.push(opts.system);
  const rest: ChatMessage[] = [];
  for (const m of opts.messages) {
    if (m.role === "system") systems.push(m.content);
    else rest.push(m);
  }
  return { system: systems.join("\n\n").trim(), messages: rest };
}

async function anthropicChat(opts: ChatOptions): Promise<ChatResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new LLMNotConfiguredError("anthropic");

  const { system, messages } = splitSystem(opts);
  const sanitized = sanitizeForAnthropic(
    messages.filter((m): m is { role: "user" | "assistant"; content: string } =>
      m.role === "user" || m.role === "assistant",
    ),
  );
  if (sanitized.length === 0) {
    throw new Error("anthropicChat: no user messages after sanitization.");
  }

  const client = new Anthropic({ apiKey });
  const model = anthropicModel(opts);
  const resp = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature,
    system: system || undefined,
    messages: sanitized,
  });

  let content = "";
  for (const block of resp.content) {
    if (block.type === "text") content += block.text;
  }
  return { content, provider: "anthropic", model };
}

function anthropicStream(opts: ChatOptions): ReadableStream<Uint8Array> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new LLMNotConfiguredError("anthropic");

  const { system, messages } = splitSystem(opts);
  const sanitized = sanitizeForAnthropic(
    messages.filter((m): m is { role: "user" | "assistant"; content: string } =>
      m.role === "user" || m.role === "assistant",
    ),
  );
  if (sanitized.length === 0) {
    throw new Error("anthropicStream: no user messages after sanitization.");
  }

  const client = new Anthropic({ apiKey });
  const model = anthropicModel(opts);
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const streamResp = await client.messages.stream({
          model,
          max_tokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature,
          system: system || undefined,
          messages: sanitized,
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
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[llm error] ${msg}`));
        controller.close();
      }
    },
  });
}

// ---------------------------------------------------------------------------
// DeepSeek — OpenAI-compatible REST (https://api.deepseek.com/v1)
// ---------------------------------------------------------------------------

const DEEPSEEK_BASE = "https://api.deepseek.com/v1";

function deepseekModel(opts: ChatOptions): string {
  if (opts.model) return opts.model;
  if (opts.reasoning) return "deepseek-reasoner";
  return process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
}

function deepseekMessages(opts: ChatOptions) {
  // OpenAI-compat keeps system as a first message (or prepended).
  const merged: ChatMessage[] = [];
  if (opts.system) merged.push({ role: "system", content: opts.system });
  merged.push(...opts.messages);
  return merged;
}

async function deepseekWithRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Only retry on transient errors.
      const msg = err instanceof Error ? err.message : String(err);
      const transient =
        msg.includes("429") ||
        msg.includes("503") ||
        msg.includes("502") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT");
      if (!transient) break;
      // Exponential backoff with jitter.
      await new Promise((r) =>
        setTimeout(r, 250 * 2 ** i + Math.random() * 100),
      );
    }
  }
  throw lastErr;
}

async function deepseekChat(opts: ChatOptions): Promise<ChatResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new LLMNotConfiguredError("deepseek");

  const model = deepseekModel(opts);
  const body = {
    model,
    messages: deepseekMessages(opts),
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature,
    stream: false,
  };

  const json = await deepseekWithRetry(async () => {
    const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `DeepSeek ${res.status}: ${await res.text().catch(() => "")}`,
      );
    }
    return (await res.json()) as {
      choices: {
        message: {
          content: string;
          reasoning_content?: string;
        };
      }[];
    };
  });

  const msg = json.choices?.[0]?.message;
  return {
    content: msg?.content ?? "",
    reasoning: msg?.reasoning_content,
    provider: "deepseek",
    model,
  };
}

function deepseekStream(opts: ChatOptions): ReadableStream<Uint8Array> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new LLMNotConfiguredError("deepseek");

  const model = deepseekModel(opts);
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: deepseekMessages(opts),
            max_tokens: opts.maxTokens ?? 1024,
            temperature: opts.temperature,
            stream: true,
          }),
        });
        if (!res.ok || !res.body) {
          throw new Error(
            `DeepSeek ${res.status}: ${await res.text().catch(() => "")}`,
          );
        }

        // Parse OpenAI-compatible SSE: lines like `data: {...}\n\n` ending
        // with `data: [DONE]`.
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          // Process every complete SSE event (blank line terminator).
          let nl: number;
          while ((nl = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, nl);
            buf = buf.slice(nl + 2);
            for (const raw of chunk.split("\n")) {
              const line = raw.trim();
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") {
                controller.close();
                return;
              }
              try {
                const j = JSON.parse(payload) as {
                  choices?: {
                    delta?: { content?: string; reasoning_content?: string };
                  }[];
                };
                const piece = j.choices?.[0]?.delta?.content;
                if (piece) controller.enqueue(encoder.encode(piece));
              } catch {
                // Tolerate malformed chunks — the stream is best-effort.
              }
            }
          }
        }
        // Flush any trailing multi-byte chars in the decoder.
        const tail = dec.decode();
        if (tail) controller.enqueue(encoder.encode(tail));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[llm error] ${msg}`));
        controller.close();
      }
    },
  });
}

// ---------------------------------------------------------------------------
// OpenAI — OpenAI-compatible REST (https://api.openai.com/v1)
// ---------------------------------------------------------------------------

const OPENAI_BASE = "https://api.openai.com/v1";

function openaiModel(opts: ChatOptions): string {
  return opts.model ?? process.env.OPENAI_MODEL ?? "gpt-4o";
}

function openaiMessages(opts: ChatOptions) {
  const merged: ChatMessage[] = [];
  if (opts.system) merged.push({ role: "system", content: opts.system });
  merged.push(...opts.messages);
  return merged;
}

async function openaiChat(opts: ChatOptions): Promise<ChatResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new LLMNotConfiguredError("openai");

  const model = openaiModel(opts);
  const body = {
    model,
    messages: openaiMessages(opts),
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature,
    stream: false,
  };

  const json = await deepseekWithRetry(async () => {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `OpenAI ${res.status}: ${await res.text().catch(() => "")}`,
      );
    }
    return (await res.json()) as {
      choices: { message: { content: string } }[];
    };
  });

  const msg = json.choices?.[0]?.message;
  return { content: msg?.content ?? "", provider: "openai", model };
}

function openaiStream(opts: ChatOptions): ReadableStream<Uint8Array> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new LLMNotConfiguredError("openai");

  const model = openaiModel(opts);
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: openaiMessages(opts),
            max_tokens: opts.maxTokens ?? 1024,
            temperature: opts.temperature,
            stream: true,
          }),
        });
        if (!res.ok || !res.body) {
          throw new Error(
            `OpenAI ${res.status}: ${await res.text().catch(() => "")}`,
          );
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, nl);
            buf = buf.slice(nl + 2);
            for (const raw of chunk.split("\n")) {
              const line = raw.trim();
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") { controller.close(); return; }
              try {
                const j = JSON.parse(payload) as {
                  choices?: { delta?: { content?: string } }[];
                };
                const piece = j.choices?.[0]?.delta?.content;
                if (piece) controller.enqueue(encoder.encode(piece));
              } catch { /* tolerate malformed chunks */ }
            }
          }
        }
        const tail = dec.decode();
        if (tail) controller.enqueue(encoder.encode(tail));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[llm error] ${msg}`));
        controller.close();
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Perplexity — OpenAI-compatible REST (https://api.perplexity.ai)
//
// Perplexity is the research workhorse: every request is backed by live web
// search, and responses include inline citations. We pass
// `return_citations: true` so the model footnotes its sources.
// ---------------------------------------------------------------------------

const PERPLEXITY_BASE = "https://api.perplexity.ai";

function perplexityModel(opts: ChatOptions): string {
  return opts.model ?? process.env.PERPLEXITY_MODEL ?? "sonar-pro";
}

function perplexityMessages(opts: ChatOptions) {
  const merged: ChatMessage[] = [];
  if (opts.system) merged.push({ role: "system", content: opts.system });
  merged.push(...opts.messages);
  return merged;
}

async function perplexityChat(opts: ChatOptions): Promise<ChatResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new LLMNotConfiguredError("perplexity");

  const model = perplexityModel(opts);
  const body = {
    model,
    messages: perplexityMessages(opts),
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature,
    return_citations: true,
    stream: false,
  };

  const json = await deepseekWithRetry(async () => {
    const res = await fetch(`${PERPLEXITY_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `Perplexity ${res.status}: ${await res.text().catch(() => "")}`,
      );
    }
    return (await res.json()) as {
      choices: { message: { content: string } }[];
      citations?: string[];
    };
  });

  const msg = json.choices?.[0]?.message;
  let content = msg?.content ?? "";
  // Append citations as footnotes when the API returns them.
  if (json.citations && json.citations.length > 0) {
    content +=
      "\n\n---\n**Sources**\n" +
      json.citations.map((url, i) => `[${i + 1}] ${url}`).join("\n");
  }
  return { content, provider: "perplexity", model };
}

function perplexityStream(opts: ChatOptions): ReadableStream<Uint8Array> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new LLMNotConfiguredError("perplexity");

  const model = perplexityModel(opts);
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(`${PERPLEXITY_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: perplexityMessages(opts),
            max_tokens: opts.maxTokens ?? 1024,
            temperature: opts.temperature,
            return_citations: true,
            stream: true,
          }),
        });
        if (!res.ok || !res.body) {
          throw new Error(
            `Perplexity ${res.status}: ${await res.text().catch(() => "")}`,
          );
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        // Collect citations from the final chunk (Perplexity returns them
        // on the last SSE event alongside `finish_reason`).
        let citations: string[] = [];
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, nl);
            buf = buf.slice(nl + 2);
            for (const raw of chunk.split("\n")) {
              const line = raw.trim();
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") {
                if (citations.length > 0) {
                  const footer =
                    "\n\n---\n**Sources**\n" +
                    citations.map((url, i) => `[${i + 1}] ${url}`).join("\n");
                  controller.enqueue(encoder.encode(footer));
                }
                controller.close();
                return;
              }
              try {
                const j = JSON.parse(payload) as {
                  choices?: { delta?: { content?: string } }[];
                  citations?: string[];
                };
                if (j.citations) citations = j.citations;
                const piece = j.choices?.[0]?.delta?.content;
                if (piece) controller.enqueue(encoder.encode(piece));
              } catch { /* tolerate malformed chunks */ }
            }
          }
        }
        // Stream ended without [DONE] — still append citations if collected.
        if (citations.length > 0) {
          const footer =
            "\n\n---\n**Sources**\n" +
            citations.map((url, i) => `[${i + 1}] ${url}`).join("\n");
          controller.enqueue(encoder.encode(footer));
        }
        const tail = dec.decode();
        if (tail) controller.enqueue(encoder.encode(tail));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[llm error] ${msg}`));
        controller.close();
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Public entrypoints
// ---------------------------------------------------------------------------

function chatRouter(provider: ProviderName) {
  switch (provider) {
    case "anthropic": return { chat: anthropicChat, stream: anthropicStream };
    case "deepseek":  return { chat: deepseekChat, stream: deepseekStream };
    case "openai":    return { chat: openaiChat, stream: openaiStream };
    case "perplexity": return { chat: perplexityChat, stream: perplexityStream };
  }
}

export function chat(opts: ChatOptions): Promise<ChatResult> {
  const provider = pickProvider(opts.provider);
  return chatRouter(provider).chat(opts);
}

export function chatStream(opts: ChatOptions): ReadableStream<Uint8Array> {
  const provider = pickProvider(opts.provider);
  return chatRouter(provider).stream(opts);
}

/**
 * Strict JSON call. Asks the model for a JSON response, extracts the first
 * balanced `{...}` from its output (some providers wrap JSON in prose or a
 * code fence), and returns the parsed object.
 *
 *  - The system prompt is augmented with "Respond ONLY with valid JSON …".
 *  - On parse failure, throws with the raw content for debugging.
 */
export async function chatJSON<T = unknown>(
  opts: ChatOptions,
): Promise<{ data: T; raw: string; provider: ProviderName; model: string }> {
  const jsonSystem =
    "Respond ONLY with a single JSON object. No prose, no code fences, no preamble.";
  const effective: ChatOptions = {
    ...opts,
    system: opts.system ? `${opts.system}\n\n${jsonSystem}` : jsonSystem,
    // Low-temperature keeps JSON structure predictable.
    temperature: opts.temperature ?? 0.1,
  };
  const out = await chat(effective);
  const parsed = parseJSONLoose(out.content);
  if (parsed === null) {
    throw new Error(`LLM did not return parseable JSON. Raw: ${out.content}`);
  }
  return {
    data: parsed as T,
    raw: out.content,
    provider: out.provider,
    model: out.model,
  };
}

/**
 * Extract the first balanced `{...}` or `[...]` from a string. Handles models
 * that wrap JSON in a code fence or add a brief explanation.
 */
function parseJSONLoose(raw: string): unknown | null {
  const trimmed = raw.trim();
  // Strip a code fence if present.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fence ? fence[1] : trimmed;

  // Try the direct parse first (happy path).
  try {
    return JSON.parse(candidate);
  } catch {
    // fall through to balanced-brace extraction
  }

  // Scan for first balanced object or array.
  const openers = ["{", "["];
  for (const open of openers) {
    const close = open === "{" ? "}" : "]";
    const start = candidate.indexOf(open);
    if (start < 0) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < candidate.length; i++) {
      const c = candidate[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(candidate.slice(start, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

/** Exposed only for the provider-status page / debug endpoint. */
export function llmProviderStatus() {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
  return {
    selected: pickProvider(),
    configured: {
      anthropic: hasAnthropic,
      deepseek: hasDeepSeek,
      openai: hasOpenAI,
      perplexity: hasPerplexity,
    },
    anyConfigured: hasAnthropic || hasDeepSeek || hasOpenAI || hasPerplexity,
  };
}

/**
 * Map an agent provider tag (from agents.ts) to the LLM provider it should
 * route through. Providers that don't have their own API integration yet
 * fall back to Anthropic (Claude proxies the persona).
 */
export function agentProviderToLLM(
  agentProvider: string,
): ProviderName {
  switch (agentProvider) {
    case "anthropic": return "anthropic";
    case "deepseek":  return "deepseek";
    case "openai":    return "openai";
    case "perplexity": return "perplexity";
    default:          return "anthropic"; // google, meta, xai, mistral, cognition → proxy via Claude
  }
}

/**
 * Check whether a given LLM provider has its API key configured.
 */
export function isProviderConfigured(provider: ProviderName): boolean {
  return !!process.env[ENV_KEY_MAP[provider]];
}
