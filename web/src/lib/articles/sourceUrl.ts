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
 *   - SSRF guard: hostname is DNS-resolved BEFORE the fetch and the
 *     resolved IP is rejected if it lands in a private, loopback,
 *     link-local, or otherwise-reserved range. The cloud metadata
 *     endpoint (169.254.169.254) is explicitly blocked by this check.
 *     The same check is re-applied after every HTTP redirect so an
 *     attacker can't bounce the request from a public host onto an
 *     internal one.
 *   - 10s total timeout via AbortController.
 *   - Max 1 MB response body; abort if ``content-length`` exceeds that
 *     OR if the streamed body grows beyond the cap.
 *   - At most ``MAX_REDIRECTS`` redirects, enforced by a manual
 *     follow-loop (Node's default 20 is too lax for an SSRF-sensitive
 *     fetch path).
 *   - Only ``text/html``, ``application/xhtml+xml``, and
 *     ``text/plain`` content types accepted.
 *
 * The HTML→text pass is intentionally *not* a full readability port —
 * we only need clean enough prose for a Claude prompt, not perfect
 * extraction. We strip script/style/nav/footer/aside/form, then
 * collapse whitespace and decode the most common HTML entities.
 */

import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP } from "node:net";
import { promisify } from "node:util";

export const MAX_BYTES = 1_000_000; // 1 MB
export const TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 5;
const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
];

const dnsLookupAsync = promisify(dnsLookup) as (
  hostname: string,
) => Promise<LookupAddress>;

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

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------

/** Parse an IPv4 address string into 4 octets, or null if not a v4 literal. */
function ipv4Octets(addr: string): [number, number, number, number] | null {
  if (isIP(addr) !== 4) return null;
  const parts = addr.split(".").map((p) => Number(p));
  if (parts.length !== 4) return null;
  if (parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return null;
  return parts as [number, number, number, number];
}

/** Return true if ``addr`` falls in a range we will not fetch. */
function isBlockedIp(addr: string): boolean {
  const v = isIP(addr);
  if (v === 0) return true; // not an IP at all → caller should re-resolve
  if (v === 4) {
    const oct = ipv4Octets(addr);
    if (!oct) return true;
    const [a, b] = oct;
    // 0.0.0.0/8 — "this" network.
    if (a === 0) return true;
    // 10.0.0.0/8 — RFC 1918 private.
    if (a === 10) return true;
    // 127.0.0.0/8 — loopback.
    if (a === 127) return true;
    // 169.254.0.0/16 — link-local + cloud metadata (169.254.169.254).
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 — RFC 1918 private.
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24 — IETF protocol assignments.
    if (a === 192 && b === 0 && oct[2] === 0) return true;
    // 192.168.0.0/16 — RFC 1918 private.
    if (a === 192 && b === 168) return true;
    // 198.18.0.0/15 — benchmarking.
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 224.0.0.0/4 — multicast.
    if (a >= 224 && a <= 239) return true;
    // 240.0.0.0/4 — reserved.
    if (a >= 240) return true;
    return false;
  }
  // IPv6 — be conservative: reject loopback, link-local, ULA, and v4-mapped
  // private addresses. The mapped-to-v4 case is the most common SSRF pivot.
  const lower = addr.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  // Link-local: fe80::/10
  if (/^fe[89ab][0-9a-f]?:/i.test(lower)) return true;
  // Unique local: fc00::/7
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
  // Multicast: ff00::/8
  if (lower.startsWith("ff")) return true;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — re-check the embedded v4.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIp(mapped[1]);
  return false;
}

/** Reject hostnames that resolve to private/reserved/cloud-metadata IPs.
 *
 * Throws ``SourceUrlError`` with status 400 if the hostname is blocked
 * literally (e.g. ``localhost``), or if DNS resolves it to a blocked
 * range. Re-applied after every redirect.
 */
async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SourceUrlError("Source URL is not a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SourceUrlError(
      "Source URL must use the http or https scheme.",
    );
  }

  const host = parsed.hostname.toLowerCase();
  // Cheap hostname blocklist for things that don't need DNS.
  if (
    host === "localhost" ||
    host === "ip6-localhost" ||
    host === "ip6-loopback" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new SourceUrlError(
      "Source URL host is not allowed (internal/private name).",
    );
  }

  // If the host is already an IP literal, validate it directly.
  if (isIP(host) !== 0) {
    if (isBlockedIp(host)) {
      throw new SourceUrlError(
        "Source URL resolves to a private or reserved address.",
      );
    }
    return parsed;
  }

  // Otherwise resolve via DNS and check the resolved IP. We use ``family: 0``
  // implicitly — Node returns whatever the system resolver gives us.
  let addr: LookupAddress;
  try {
    addr = await dnsLookupAsync(host);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new SourceUrlError(`DNS lookup failed for ${host}: ${msg}`, 502);
  }
  if (!addr || !addr.address) {
    throw new SourceUrlError(`DNS lookup returned no address for ${host}.`);
  }
  if (isBlockedIp(addr.address)) {
    throw new SourceUrlError(
      "Source URL resolves to a private or reserved address.",
    );
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/** Fetch a URL with our safety limits. Throws ``SourceUrlError`` on any
 * violation so the caller can surface a useful 4xx to the user. */
export async function fetchSourceUrl(url: string): Promise<FetchedSource> {
  const trimmed = url.trim();
  if (!isHttpUrl(trimmed)) {
    throw new SourceUrlError("URL must start with http:// or https://.");
  }

  // SSRF check on the *initial* URL before we touch the network.
  await assertSafeUrl(trimmed);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Manual redirect loop so we can (a) cap at MAX_REDIRECTS and (b)
    // re-run the SSRF guard against every Location target.
    let currentUrl = trimmed;
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const r = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          // Identify ourselves so site operators can see who is fetching.
          "User-Agent":
            "sofai-article-bot/1.0 (+https://sof.ai; contact freedom@thevrschool.org)",
          Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8",
        },
      });
      // 3xx with a Location header — follow up to MAX_REDIRECTS times.
      if (r.status >= 300 && r.status < 400) {
        const location = r.headers.get("location");
        if (!location) {
          throw new SourceUrlError(
            `Source URL responded ${r.status} without a Location header.`,
            502,
          );
        }
        if (hop >= MAX_REDIRECTS) {
          throw new SourceUrlError(
            `Source URL exceeded ${MAX_REDIRECTS} redirects.`,
          );
        }
        // Resolve relative redirects against the current URL.
        const next = new URL(location, currentUrl).toString();
        // Re-run the SSRF guard against every redirect target.
        await assertSafeUrl(next);
        currentUrl = next;
        // Drain the body so the connection can be reused / freed.
        try {
          await r.body?.cancel();
        } catch {
          // Ignore — the response is being discarded anyway.
        }
        continue;
      }
      res = r;
      break;
    }
    if (!res) {
      // Should be unreachable — the loop either follows a redirect or sets res.
      throw new SourceUrlError(
        "Source URL did not produce a final response.",
        502,
      );
    }

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
      finalUrl: res.url || currentUrl,
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

// Internal exports for unit testing.
export const __test = { isBlockedIp, assertSafeUrl };
