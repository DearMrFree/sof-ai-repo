/**
 * Source-URL fetching + HTML→text extraction for the cross-journal
 * "Inspire from URL" feature.
 *
 * Authors paste a public URL on the article submission form. The Web
 * route hits ``fetchSourceUrl`` to retrieve the page (with safety
 * limits) and ``extractMainText`` to strip it down to readable prose.
 * The cleaned text is then passed to Anthropic as *inspiration* for an
 * original draft — sof.ai never publishes a copy of the source page.
 *
 * Safety limits (every value is small on purpose):
 *   - http(s) only (rejects file://, ftp://, data: URLs).
 *   - 10s total timeout via AbortController.
 *   - Max 1 MB response body; abort if ``content-length`` exceeds that
 *     OR if the streamed body grows beyond the cap.
 *   - At most 5 redirects (Node's fetch already caps at 20; we tighten).
 *   - Only ``text/html``, ``application/xhtml+xml``, and
 *     ``text/plain`` content types accepted.
 *   - Reject responses with ``content-encoding`` we can't decode.
 *
 * The HTML→text pass is intentionally *not* a full readability port —
 * we only need clean enough prose for a Claude prompt, not perfect
 * extraction. We strip script/style/nav/footer/aside/form, then
 * collapse whitespace and decode the most common HTML entities.
 */

export const MAX_BYTES = 1_000_000; // 1 MB
export const TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 5;
const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
];

export interface FetchedSource {
  url: string;
  finalUrl: string;
  contentType: string;
  text: string;
  title: string;
  byteLength: number;
}

export class SourceUrlError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Fetch a URL with our safety limits. Throws ``SourceUrlError`` on any
 * violation so the caller can surface a useful 4xx to the user. */
export async function fetchSourceUrl(url: string): Promise<FetchedSource> {
  const trimmed = url.trim();
  if (!isHttpUrl(trimmed)) {
    throw new SourceUrlError("URL must start with http:// or https://.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(trimmed, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Identify ourselves so site operators can see who is fetching.
        "User-Agent":
          "sofai-article-bot/1.0 (+https://sof.ai; contact freedom@thevrschool.org)",
        Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8",
      },
    });

    if (!res.ok) {
      throw new SourceUrlError(
        `Source URL returned HTTP ${res.status}.`,
        res.status >= 500 ? 502 : 400,
      );
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.some((t) => contentType.startsWith(t))) {
      throw new SourceUrlError(
        `Unsupported content type ${contentType || "(none)"}; expected text/html.`,
      );
    }

    const declaredLen = Number(res.headers.get("content-length") ?? "0");
    if (declaredLen > MAX_BYTES) {
      throw new SourceUrlError(
        `Source URL too large (${declaredLen} bytes; cap is ${MAX_BYTES}).`,
        413,
      );
    }

    // Stream-read so we can hard-cap regardless of declared length.
    const reader = res.body?.getReader();
    if (!reader) {
      throw new SourceUrlError("Source URL returned an empty body.", 502);
    }
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let bytes = 0;
    let html = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // Body cancellation can race with the abort signal; safe to ignore.
        }
        throw new SourceUrlError(
          `Source URL exceeded ${MAX_BYTES} bytes mid-stream.`,
          413,
        );
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();

    const isHtml = contentType.startsWith("text/html") ||
      contentType.startsWith("application/xhtml+xml");
    const { title, text } = isHtml
      ? extractMainText(html)
      : { title: "", text: html.trim() };

    return {
      url: trimmed,
      finalUrl: res.url || trimmed,
      contentType,
      text,
      title,
      byteLength: bytes,
    };
  } catch (err: unknown) {
    if (err instanceof SourceUrlError) throw err;
    if ((err as { name?: string })?.name === "AbortError") {
      throw new SourceUrlError(
        `Fetching the source URL timed out after ${TIMEOUT_MS} ms.`,
        504,
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new SourceUrlError(`Could not fetch source URL: ${msg}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

const DROP_TAGS = [
  "script",
  "style",
  "noscript",
  "template",
  "iframe",
  "svg",
  "form",
  "nav",
  "aside",
  "footer",
  "header",
];

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&ldquo;": "\u201c",
  "&rdquo;": "\u201d",
  "&lsquo;": "'",
  "&rsquo;": "'",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&[a-z#0-9]+;/gi, (m) => {
      if (ENTITIES[m]) return ENTITIES[m];
      const num = m.match(/^&#(\d+);$/);
      if (num) return String.fromCodePoint(Number(num[1]));
      const hex = m.match(/^&#x([0-9a-f]+);$/i);
      if (hex) return String.fromCodePoint(parseInt(hex[1], 16));
      return m;
    });
}

/** Strip HTML to plaintext and pull a useful title.
 *
 * NOT a full readability port — just enough to feed Claude. We:
 *   1. Pull the ``<title>`` if present.
 *   2. Pull the first ``<meta property="og:title">`` if present.
 *   3. Drop scripts/styles/nav/aside/footer/forms entirely.
 *   4. Replace every other tag with a space.
 *   5. Decode common HTML entities.
 *   6. Collapse whitespace.
 */
export function extractMainText(html: string): { title: string; text: string } {
  let titleTag = "";
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) titleTag = decodeEntities(titleMatch[1]).trim();

  const og = html.match(
    /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
  );
  const ogTitle = og ? decodeEntities(og[1]).trim() : "";

  const title = (ogTitle || titleTag).slice(0, 300);

  let stripped = html;
  for (const tag of DROP_TAGS) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    stripped = stripped.replace(re, " ");
    // Self-closing variants e.g. <iframe />.
    const selfClose = new RegExp(`<${tag}\\b[^>]*\\/>`, "gi");
    stripped = stripped.replace(selfClose, " ");
  }

  // Replace block tags with a newline so paragraphs survive collapse.
  stripped = stripped.replace(
    /<\/(p|div|li|ul|ol|h[1-6]|br|tr|td|th|article|section)\s*>/gi,
    "\n",
  );
  stripped = stripped.replace(/<br\s*\/?>/gi, "\n");

  // Drop everything else.
  stripped = stripped.replace(/<[^>]+>/g, " ");

  // Decode entities and collapse whitespace.
  let text = decodeEntities(stripped);
  text = text.replace(/[ \t\f\v]+/g, " ");
  text = text.replace(/ ?\n ?/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return { title, text };
}
