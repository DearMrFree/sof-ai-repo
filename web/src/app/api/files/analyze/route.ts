import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAgent, agentHasCapability } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnalyzeRequest {
  agentId: string;
  blobUrl: string;
  fileName: string;
  contentType: string;
  size: number;
  prompt?: string;
}

/**
 * SSRF guard: only allow fetches to Vercel Blob domains. The default
 * Vercel Blob CDN serves uploads at ``<store>.public.blob.vercel-storage.com``;
 * custom blob domains are opt-in via ``BLOB_PUBLIC_HOSTNAMES`` (comma-
 * separated). Without this check an authenticated caller could pass
 * ``http://169.254.169.254/...`` (cloud metadata) or any internal URL
 * and the server would fetch + reflect / embed it.
 */
function isAllowedBlobUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (host.endsWith(".public.blob.vercel-storage.com")) return true;
  if (host === "public.blob.vercel-storage.com") return true;
  const extras = (process.env.BLOB_PUBLIC_HOSTNAMES ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return extras.some((h) => host === h || host.endsWith("." + h));
}

/**
 * Hard cap on bytes we pull back from Blob into memory for the Anthropic
 * call. The upload itself is uncapped (per product call) but a 50K-token
 * analysis pass is enough to surface structure / extract findings, and
 * larger reads would blow Anthropic's input window anyway. ~200KB of raw
 * UTF-8 text is roughly 50K tokens.
 */
const MAX_INLINE_BYTES = 200_000;

const TEXT_LIKE = /^(text\/|application\/(json|xml|x-ndjson|x-yaml|yaml|csv|sql|javascript|typescript|x-sh))/i;

function isTextish(contentType: string, fileName: string): boolean {
  if (TEXT_LIKE.test(contentType)) return true;
  // Fall back to extension when the upload chose
  // application/octet-stream — happens for code files on most browsers.
  return /\.(md|txt|csv|json|yml|yaml|xml|sql|py|ts|tsx|js|jsx|rs|go|java|kt|rb|php|c|cpp|h|hpp|cs|swift|sh|toml|ini|cfg|env|log)$/i.test(
    fileName,
  );
}

/**
 * Office-hours file analysis: pull the blob, hand it to Claude with a
 * focused system prompt, stream the analysis back as plain text.
 *
 * Caller is the chat client. Streamed output is appended to the agent
 * thread on the frontend. Auth-gated.
 *
 * The endpoint is agent-aware: a non-Claude agent without
 * ``file_analysis`` is rejected with a 400 + a hint to hand off to
 * Claude. The frontend already renders the handoff button so this
 * branch is a defense-in-depth for direct callers.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Sign in to analyze files.", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      "Analysis is not configured. Set ANTHROPIC_API_KEY in the server environment.",
      { status: 503, headers: { "Content-Type": "text/plain" } },
    );
  }

  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const agent = getAgent(body.agentId);
  if (!agent) {
    return new Response(`Unknown agent: ${body.agentId}`, { status: 404 });
  }
  if (!agentHasCapability(agent, "file_analysis")) {
    return new Response(
      `${agent.name} doesn't run file analysis during office hours. Hand off to Claude instead.`,
      { status: 400, headers: { "Content-Type": "text/plain" } },
    );
  }

  if (!isAllowedBlobUrl(body.blobUrl)) {
    return new Response(
      "blobUrl must point to a Vercel Blob domain.",
      { status: 400, headers: { "Content-Type": "text/plain" } },
    );
  }

  let fileText = "";
  let truncated = false;
  let binarySummary: string | null = null;

  try {
    const res = await fetch(body.blobUrl);
    if (!res.ok) {
      return new Response(
        `Failed to fetch uploaded file: ${res.status} ${res.statusText}`,
        { status: 502, headers: { "Content-Type": "text/plain" } },
      );
    }
    if (!res.body) {
      return new Response("Blob response had no body.", {
        status: 502,
        headers: { "Content-Type": "text/plain" },
      });
    }
    if (isTextish(body.contentType, body.fileName)) {
      // Stream-read only the first MAX_INLINE_BYTES, then cancel the
      // remaining stream. ``upload`` accepts arbitrarily large files
      // by design, but the analyzer must never buffer more than the
      // budget into memory — otherwise an authenticated caller can
      // OOM the serverless function with a single multi-GB upload.
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let downloaded = 0;
      let streamDone = false;
      while (downloaded < MAX_INLINE_BYTES) {
        const { value, done } = await reader.read();
        if (done) {
          streamDone = true;
          break;
        }
        chunks.push(value);
        downloaded += value.byteLength;
      }
      if (!streamDone) {
        // Best-effort: tell the upstream we're done so the connection
        // doesn't sit half-open. Errors here aren't actionable.
        await reader.cancel().catch(() => undefined);
      }
      truncated = downloaded > MAX_INLINE_BYTES || !streamDone;
      // Concatenate up to the budget. The last chunk may push us
      // slightly past MAX_INLINE_BYTES; slice down before decode.
      const merged = new Uint8Array(Math.min(downloaded, MAX_INLINE_BYTES));
      let offset = 0;
      for (const chunk of chunks) {
        if (offset >= merged.byteLength) break;
        const room = merged.byteLength - offset;
        const take = chunk.byteLength <= room ? chunk : chunk.subarray(0, room);
        merged.set(take, offset);
        offset += take.byteLength;
      }
      fileText = new TextDecoder("utf-8", { fatal: false }).decode(merged);
    } else {
      // For PDFs / binary blobs we describe the file at a high level
      // rather than attempting OCR / parsing in this minimal v1. The
      // frontend can still surface the file URL to the user for manual
      // download, and Claude can reason about the metadata.
      // Cancel the body stream we won't consume so the underlying
      // connection is released promptly.
      await res.body.cancel().catch(() => undefined);
      binarySummary = [
        `Binary file uploaded: ${body.fileName}`,
        `MIME: ${body.contentType}`,
        `Size: ${body.size} bytes`,
        `Downloadable at: ${body.blobUrl}`,
        "(Inline text extraction not available in this analyzer pass — describe what you'd want to do with this kind of file and recommend next steps.)",
      ].join("\n");
    }
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "Failed to read uploaded file.",
      { status: 502, headers: { "Content-Type": "text/plain" } },
    );
  }

  const userPrompt = body.prompt?.trim() || "Analyze this file carefully.";
  const fileBlock = binarySummary
    ? binarySummary
    : `\`\`\`${truncated ? "" : ""}\n${fileText}\n\`\`\`${
        truncated
          ? `\n\n(Truncated — only the first ${MAX_INLINE_BYTES} bytes shown out of ${body.size}.)`
          : ""
      }`;

  const system = [
    agent.systemPrompt,
    "\nYou are running a focused **office-hours file analysis** for the learner. They've uploaded a file and want a substantive read of it.",
    "Lead with a one-paragraph summary of what the file is and what stands out. Then call out specific findings with line numbers / section names where relevant. Close with concrete next steps the learner can take.",
    "If the file is incomplete or doesn't match what they're asking, say so plainly — this is office hours, not a polite review.",
  ].join("\n");

  const userMessage = `${userPrompt}\n\n**File:** ${body.fileName}\n\n${fileBlock}`;

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const streamResp = await client.messages.stream({
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
          max_tokens: 2048,
          system,
          messages: [{ role: "user", content: userMessage }],
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
