/**
 * Parse `<HANDOFF target="claude" reason="file-analysis">…</HANDOFF>` tokens
 * out of streamed agent responses. We render them as clickable
 * referral buttons in the chat UI instead of leaving raw markup
 * showing through.
 *
 * The format is intentionally permissive: attribute order and quoting
 * style don't matter, and the body inside the tags is treated as the
 * human-readable description of why the hand-off is being recommended.
 *
 * The parser is streaming-friendly — call it on every accumulated
 * buffer and it'll always emit the same set of segments for the same
 * input prefix, plus a "trailing" pending range that the caller can
 * choose to render as plain text or hide while a tag is still being
 * written out by the model.
 */

export interface HandoffSegment {
  kind: "text" | "handoff";
  text: string;
  target?: string;
  reason?: string;
}

const HANDOFF_RE = /<HANDOFF\s+([^>]*?)>([\s\S]*?)<\/HANDOFF>/gi;
const ATTR_RE = /(\w+)\s*=\s*"([^"]*)"|(\w+)\s*=\s*'([^']*)'|(\w+)\s*=\s*([^\s>]+)/g;

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(raw)) !== null) {
    const key = (m[1] ?? m[3] ?? m[5] ?? "").toLowerCase();
    const val = m[2] ?? m[4] ?? m[6] ?? "";
    if (key) out[key] = val;
  }
  return out;
}

export function parseHandoffs(text: string): HandoffSegment[] {
  const segments: HandoffSegment[] = [];
  let cursor = 0;
  HANDOFF_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HANDOFF_RE.exec(text)) !== null) {
    const start = match.index;
    if (start > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, start) });
    }
    const attrs = parseAttrs(match[1] ?? "");
    segments.push({
      kind: "handoff",
      text: (match[2] ?? "").trim(),
      target: attrs.target,
      reason: attrs.reason,
    });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) });
  }
  return segments;
}

/**
 * Detect whether the *trailing* unclosed text contains an in-progress
 * `<HANDOFF>` open tag that hasn't been closed yet. The chat renderer
 * uses this to hide partial markup while a token is mid-stream.
 */
export function hasOpenHandoff(text: string): boolean {
  const open = text.lastIndexOf("<HANDOFF");
  if (open === -1) return false;
  const close = text.indexOf("</HANDOFF>", open);
  return close === -1;
}
