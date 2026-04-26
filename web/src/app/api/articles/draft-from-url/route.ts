/**
 * POST /api/articles/draft-from-url
 *
 * Cross-journal "Inspire from URL" feature. Authors paste a public URL
 * on the article submission form; this route fetches the page (with
 * safety limits — see ``lib/articles/sourceUrl.ts``) and asks Claude
 * to write a *new, original* draft that is more pedagogically useful
 * than the source. The author then reviews/edits the draft fields and
 * submits to the journal in the normal way.
 *
 * sof.ai never publishes a copy of the source page — the URL is just
 * inspiration. The draft is anchored in the *journal's* lens (e.g. for
 * ``agentic-teaching`` we ask for a teaching-expert framing) and
 * grounded in sof.ai's LMS as a running example.
 *
 * Auth: signed-in users only (anonymous traffic gets a 401).
 *
 * Returns: ``{ title, abstract, body, source_url, source_title }``.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  fetchSourceUrl,
  SourceUrlError,
} from "@/lib/articles/sourceUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_TEXT_BUDGET = 18_000; // ~4-5K tokens; leaves room in 200K context.

interface DraftPayload {
  source_url?: unknown;
  journal_slug?: unknown;
  title_hint?: unknown;
  intent?: unknown;
}

interface DraftResult {
  title: string;
  abstract: string;
  body: string;
  source_url: string;
  source_title: string;
}

const JOURNAL_LENS: Record<string, { audience: string; voice: string }> = {
  "agentic-teaching": {
    audience:
      "verified teaching experts (educators, curriculum designers, " +
      "professors, K-12 + higher-ed teachers) who already understand " +
      "software design or computing, and the agentic engineers who read " +
      "alongside them",
    voice:
      "a teaching expert turning lived classroom practice into a coding " +
      "principle that humans AND agents can absorb. Use sof.ai's LMS " +
      "(github.com/DearMrFree/sof-ai-repo) as a running example wherever " +
      "it strengthens the point — cite specific merged PRs by number when " +
      "relevant.",
  },
  "journal-ai": {
    audience:
      "practitioner-scholars publishing on AI-native software " +
      "engineering and education technology",
    voice:
      "a practitioner-scholar writing for peers — claims should be " +
      "testable, citations specific, and prose tight.",
  },
};

function lensFor(slug: string): { audience: string; voice: string } {
  return (
    JOURNAL_LENS[slug] ?? {
      audience: "the journal's readership",
      voice:
        "an expert author writing an original article that is " +
        "demonstrably more useful than the source URL.",
    }
  );
}

function buildSystemPrompt(slug: string, sourceTitle: string): string {
  const lens = lensFor(slug);
  return [
    `You are sof.ai's article-drafting assistant for the "${slug}" journal.`,
    `Audience: ${lens.audience}.`,
    `Voice: ${lens.voice}`,
    "",
    "The author has handed you a public URL as INSPIRATION ONLY. You must",
    "produce an ORIGINAL article that is demonstrably better than the source",
    "— deeper, more useful, more honest, with a clearer thesis and concrete",
    "examples. Do NOT copy sentences or structure from the source. Do NOT",
    "lift its title verbatim. The source is a starting point; the draft is",
    "the author's own work, drafted with your help.",
    "",
    "The source page's title is: " + (sourceTitle || "(unknown)") + ".",
    "",
    "Output STRICT JSON with exactly these keys:",
    '  - "title": string, max 200 characters, sentence case, no marketing',
    "    fluff. The title must commit to a thesis.",
    '  - "abstract": string, 80-180 words, plain prose, no bullet points.',
    '  - "body": string, 1500-2500 words of GitHub-flavored Markdown,',
    "    using ## section headings, occasional bullet lists, and inline",
    "    links where useful. The body must include at least one concrete",
    "    example, at least one falsifiable claim, and at least one piece",
    "    of practical advice the reader can apply this week.",
    "",
    "Return ONLY the JSON object. No prose before or after. No code fences.",
  ].join("\n");
}

function buildUserMessage(
  sourceTitle: string,
  sourceUrl: string,
  sourceText: string,
  titleHint: string,
  intent: string,
): string {
  const truncated = sourceText.slice(0, SOURCE_TEXT_BUDGET);
  const truncatedNote =
    sourceText.length > SOURCE_TEXT_BUDGET
      ? `\n\n[Source truncated to ${SOURCE_TEXT_BUDGET} chars; original was ${sourceText.length}.]`
      : "";
  const hintLine = titleHint
    ? `Author's working title: ${titleHint}\n`
    : "";
  const intentLine = intent ? `Author's intent: ${intent}\n` : "";
  return [
    `Source URL: ${sourceUrl}`,
    `Source title: ${sourceTitle || "(unknown)"}`,
    hintLine + intentLine,
    "BEGIN SOURCE TEXT",
    truncated + truncatedNote,
    "END SOURCE TEXT",
    "",
    "Write the original article that is better than this source, in the",
    "journal's voice, returning STRICT JSON as specified.",
  ].join("\n");
}

function tryParseDraftJson(raw: string): DraftResult | null {
  // Tolerate a fenced ```json block even though we asked for raw JSON.
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  // Extract the largest JSON object substring as a defensive fallback —
  // some Claude replies leak a sentence after the JSON.
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  const slice = s.slice(first, last + 1);
  try {
    const parsed = JSON.parse(slice) as Record<string, unknown>;
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const abstract =
      typeof parsed.abstract === "string" ? parsed.abstract.trim() : "";
    const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (!title || !body) return null;
    return {
      title: title.slice(0, 300),
      abstract: abstract.slice(0, 4000),
      body: body.slice(0, 200_000),
      source_url: "",
      source_title: "",
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string } | undefined;
  if (!sessionUser?.id) {
    return NextResponse.json(
      { error: "Sign in to draft from a URL." },
      { status: 401 },
    );
  }

  let payload: DraftPayload;
  try {
    payload = (await req.json()) as DraftPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sourceUrl =
    typeof payload.source_url === "string" ? payload.source_url.trim() : "";
  const journalSlug =
    typeof payload.journal_slug === "string"
      ? payload.journal_slug.trim().slice(0, 80)
      : "";
  const titleHint =
    typeof payload.title_hint === "string"
      ? payload.title_hint.trim().slice(0, 200)
      : "";
  const intent =
    typeof payload.intent === "string"
      ? payload.intent.trim().slice(0, 600)
      : "";

  if (sourceUrl.length < 8) {
    return NextResponse.json(
      { error: "source_url is required." },
      { status: 400 },
    );
  }
  if (!journalSlug) {
    return NextResponse.json(
      { error: "journal_slug is required." },
      { status: 400 },
    );
  }

  let fetched;
  try {
    fetched = await fetchSourceUrl(sourceUrl);
  } catch (err) {
    if (err instanceof SourceUrlError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json(
      { error: `Source URL fetch failed: ${msg}` },
      { status: 502 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured on this deployment." },
      { status: 503 },
    );
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

  let raw = "";
  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 4096,
      system: buildSystemPrompt(journalSlug, fetched.title),
      messages: [
        {
          role: "user",
          content: buildUserMessage(
            fetched.title,
            fetched.finalUrl,
            fetched.text,
            titleHint,
            intent,
          ),
        },
      ],
    });
    for (const block of resp.content) {
      if (block.type === "text") raw += block.text;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json(
      { error: `Drafting model call failed: ${msg}` },
      { status: 502 },
    );
  }

  const parsed = tryParseDraftJson(raw);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Drafting model returned an unparseable response. Try again or " +
          "submit a manual draft.",
      },
      { status: 502 },
    );
  }

  const result: DraftResult = {
    ...parsed,
    source_url: fetched.finalUrl,
    source_title: fetched.title,
  };

  return NextResponse.json(result, { status: 200 });
}
