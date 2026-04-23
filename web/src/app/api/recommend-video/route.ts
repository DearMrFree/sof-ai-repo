import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pickResources, RESOURCES, type Resource } from "@/lib/resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RecommendRequest {
  /**
   * Free-form topic the learner is on. Keep short — we tokenize this
   * into tags + pass a trimmed version to the LLM ranker.
   */
  topic?: string;
  /** Optional lesson slug / title for extra context. */
  lessonSlug?: string;
  lessonTitle?: string;
  programSlug?: string;
  /** If a learner just logged a challenge, the body of that challenge. */
  challenge?: string;
  /** Max number of recommendations. Defaults to 3. */
  limit?: number;
}

interface Recommendation {
  id: string;
  kind: Resource["kind"];
  title: string;
  url: string;
  blurb: string;
  source?: string;
  duration?: string;
  /** "curated" when matched directly, "ai" when Anthropic ranked. */
  reason: "curated" | "ai";
}

/**
 * Turn free-form strings into lowercase tag candidates the curated
 * registry can match on.
 *
 * Kept intentionally dumb — topic strings like "Claude Code streaming"
 * become ["claude", "code", "claude-code", "streaming"] because we
 * want simple, well-understood behavior before layering the LLM.
 */
function toTags(parts: (string | undefined)[]): string[] {
  const tokens = new Set<string>();
  for (const p of parts) {
    if (!p) continue;
    const lowered = p.toLowerCase();
    // split on anything non-alphanumeric
    for (const t of lowered.split(/[^a-z0-9]+/)) {
      if (t && t.length > 1) tokens.add(t);
    }
    // preserve compound hints the learner likely wrote
    for (const phrase of [
      "claude-code",
      "agent-skills",
      "agent-sdk",
      "claude-api",
      "mcp",
      "gemini",
      "openai",
    ]) {
      if (lowered.includes(phrase.replace("-", " ")) || lowered.includes(phrase)) {
        tokens.add(phrase);
      }
    }
  }
  return Array.from(tokens);
}

export async function POST(req: NextRequest) {
  // Gate behind auth so anonymous callers can't pound the endpoint and
  // drain the Anthropic budget when we fall back to the LLM path.
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json(
      { error: "Sign in to get video recommendations." },
      { status: 401 },
    );
  }

  let body: RecommendRequest;
  try {
    body = (await req.json()) as RecommendRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const limit = Math.min(Math.max(body.limit ?? 3, 1), 5);
  const tags = toTags([
    body.topic,
    body.lessonTitle,
    body.lessonSlug,
    body.programSlug,
    body.challenge,
  ]);

  // Layer 1 — curated match on tag overlap. Cheap, offline, deterministic.
  const curatedVideos = pickResources(tags, limit, ["video"]);
  const curatedSupport = pickResources(tags, Math.max(limit - curatedVideos.length, 0), [
    "guide",
    "repo",
  ]);

  const curated: Recommendation[] = [...curatedVideos, ...curatedSupport].map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    url: r.url,
    blurb: r.blurb,
    source: r.source,
    duration: r.duration,
    reason: "curated" as const,
  }));

  // If we have enough curated hits, return them and skip the LLM call.
  if (curated.length >= limit) {
    return Response.json({ recommendations: curated.slice(0, limit) });
  }

  // Layer 2 — ask Anthropic to rank the registry for this specific ask.
  // We DO NOT let the model invent new URLs; it only picks from the
  // registry. This keeps outputs safe, cheap, and citeable.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No key, no fallback — just return whatever curated results we have.
    return Response.json({ recommendations: curated });
  }

  const catalogForModel = RESOURCES.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    url: r.url,
    tags: r.tags,
    blurb: r.blurb,
  }));

  const userAsk = [
    body.topic && `Topic: ${body.topic}`,
    body.lessonTitle && `Current lesson: ${body.lessonTitle}`,
    body.programSlug && `Program: ${body.programSlug}`,
    body.challenge && `Challenge they logged: ${body.challenge}`,
  ]
    .filter(Boolean)
    .join("\n");

  const system = [
    "You are sof.ai's resource recommender. You must only pick items from the provided catalog.",
    "Never invent URLs. Return strict JSON matching the schema.",
  ].join(" ");

  const prompt = [
    userAsk || "No context provided; recommend starter videos for learners new to Claude.",
    "",
    "Catalog JSON (id, kind, title, url, tags, blurb):",
    JSON.stringify(catalogForModel),
    "",
    `Return ONLY a JSON object: { "picks": [ { "id": string, "reason": string } ] }`,
    `Pick at most ${limit} items. Reason should be ≤140 chars and explain why THIS resource helps THIS learner right now.`,
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
      max_tokens: 800,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = res.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ recommendations: curated });
    }
    const raw = textBlock.text.trim();
    // Tolerate the model putting the JSON inside ``` fences.
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      return Response.json({ recommendations: curated });
    }
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
      picks?: { id?: unknown; reason?: unknown }[];
    };
    const picks = Array.isArray(parsed.picks) ? parsed.picks : [];
    const aiRecs: Recommendation[] = [];
    for (const p of picks) {
      if (typeof p.id !== "string") continue;
      const r = RESOURCES.find((x) => x.id === p.id);
      if (!r) continue;
      aiRecs.push({
        id: r.id,
        kind: r.kind,
        title: r.title,
        url: r.url,
        blurb: typeof p.reason === "string" && p.reason.length <= 200 ? p.reason : r.blurb,
        source: r.source,
        duration: r.duration,
        reason: "ai" as const,
      });
      if (aiRecs.length >= limit) break;
    }

    // De-dupe curated + ai by id; curated wins on ties (cheaper + deterministic).
    const seen = new Set<string>();
    const combined: Recommendation[] = [];
    for (const rec of [...curated, ...aiRecs]) {
      if (seen.has(rec.id)) continue;
      seen.add(rec.id);
      combined.push(rec);
      if (combined.length >= limit) break;
    }
    return Response.json({ recommendations: combined });
  } catch {
    // Any Anthropic failure: fall through to curated-only.
    return Response.json({ recommendations: curated });
  }
}
