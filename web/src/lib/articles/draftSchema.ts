/**
 * Shared schema + parsing for `/api/articles/draft-from-url`.
 *
 * The drafting model returns its result via Anthropic's tool-use mode (see
 * `PUBLISH_DRAFT_TOOL`), which guarantees the input is schema-valid JSON.
 * `tryParseDraftJson` is kept as a defensive fallback for the rare case
 * where the model declines tool-use and emits prose containing JSON; it
 * tolerates fenced blocks and trailing commentary but cannot recover from
 * unescaped quotes inside string values, which is exactly the failure mode
 * tool-use eliminates.
 */

export interface DraftResult {
  title: string;
  abstract: string;
  body: string;
  source_url: string;
  source_title: string;
}

export const PUBLISH_DRAFT_TOOL = {
  name: "publish_draft",
  description:
    "Publish the article draft for the author to review and edit before " +
    "submitting it to the journal.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description:
          "Sentence-case article title, max 200 characters, no fluff. " +
          "Must commit to a thesis.",
      },
      abstract: {
        type: "string",
        description:
          "80-180 words of plain prose summarizing the article. No bullets.",
      },
      body: {
        type: "string",
        description:
          "1500-2500 words of GitHub-flavored Markdown with ## section " +
          "headings, occasional bullets, and inline links. Must include " +
          "at least one concrete example, one falsifiable claim, and one " +
          "piece of practical advice.",
      },
    },
    required: ["title", "abstract", "body"],
  },
};

export function coerceDraftFromInput(input: unknown): DraftResult | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const abstract =
    typeof obj.abstract === "string" ? obj.abstract.trim() : "";
  const body = typeof obj.body === "string" ? obj.body.trim() : "";
  if (!title || !body) return null;
  return {
    title: title.slice(0, 300),
    abstract: abstract.slice(0, 4000),
    body: body.slice(0, 200_000),
    source_url: "",
    source_title: "",
  };
}

export function tryParseDraftJson(raw: string): DraftResult | null {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  const slice = s.slice(first, last + 1);
  try {
    return coerceDraftFromInput(JSON.parse(slice));
  } catch {
    return null;
  }
}
