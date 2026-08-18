import { chunkText } from "@/lib/security/chunking";

export interface CrawledChunk {
  content: string;
  index: number;
  metadata: Record<string, unknown>;
}

export interface CrawlResult {
  title: string | null;
  text: string;
  chunks: CrawledChunk[];
}

export interface CrawlOptions {
  maxBytes?: number;
  timeoutMs?: number;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Fetch a single page and extract readable text from its HTML.
 *
 * The page is fetched with a timeout and a streaming size cap so a single bad
 * origin cannot hog resources. The returned text is chunked with the same
 * chunking used for pasted text/FAQ sources so chunks stay searchable by
 * `vectorSearch`.
 */
export async function crawlUrl(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; AgentAICrawler/1.0; +https://vip.sitenexai.com)",
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
  };

  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });

  if (!response.ok) {
    throw new Error(`Failed to fetch page (HTTP ${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error(`Unsupported content type "${contentType || "unknown"}". Only HTML pages can be crawled.`);
  }

  if (!response.body) {
    throw new Error("No response body received.");
  }

  const html = await readWithCap(response.body, maxBytes);
  const title = extractTitle(html);
  const text = htmlToText(html).trim();

  if (text.length < 10) {
    throw new Error("No readable text found on the page.");
  }

  const chunks = chunkText(text, { splitOn: "paragraph" }).map((chunk) => ({
    content: chunk.content,
    index: chunk.index,
    metadata: { ...chunk.metadata, source: "website", url: response.url ?? url },
  }));

  return { title: title ?? null, text, chunks };
}

async function readWithCap(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Page exceeds the ${maxBytes / 1024 / 1024}MB size limit.`);
    }

    result += decoder.decode(value, { stream: true });
  }

  return result;
}

/** Page title, decoded, or null when the document has none. */
export function extractTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return null;
  return decodeEntities(stripTags(match[1])).replace(/\s+/g, " ").trim().slice(0, 256) || null;
}

/**
 * Convert raw HTML into readable plain text.
 *
 * Block-level elements are turned into paragraph breaks before tags are
 * stripped so the text keeps its structure for paragraph-based chunking.
 */
export function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ");

  return decodeEntities(stripTags(withoutNoise));
}

function stripTags(html: string): string {
  const blockContent = html
    .replace(/<\s*(p|div|article|section|main|li|ul|ol|h[1-6]|blockquote|pre|tr|table|br)[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return blockContent;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const point = Number.parseInt(code, 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    });
}
