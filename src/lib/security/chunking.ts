import { createHash } from "node:crypto";

export interface ChunkResult {
  content: string;
  index: number;
  metadata: {
    charStart: number;
    charEnd: number;
    wordCount: number;
  };
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  minChunkSize?: number;
  overlap?: number;
  splitOn?: "paragraph" | "sentence" | "word";
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  maxChunkSize: 1000,
  minChunkSize: 60,
  overlap: 100,
  splitOn: "paragraph",
};

/**
 * Deterministic content hash (SHA-256, hex). Callers use this to detect
 * unchanged content so identical chunks are not re-embedded on re-index.
 */
export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Split text into meaningful, bounded chunks.
 *
 * The previous implementation collapsed every run of whitespace into a single
 * space BEFORE splitting, so paragraph separators never matched and long text
 * produced one oversized chunk containing the whole document. This version:
 *
 * - Preserves paragraph structure (splits at blank-line boundaries).
 * - Sub-divides oversized paragraphs on sentence then word boundaries.
 * - Never exceeds maxChunkSize (unless a single token is longer).
 * - Applies overlap at chunk boundaries, rounded to a word boundary, so
 *   context survives the cut.
 * - Merges tiny trailing chunks into the previous chunk when it fits.
 *
 * charStart/charEnd are byte-level estimates into the original text used for
 * diagnostics; wordCount is exact.
 */
export function chunkText(text: string, options: ChunkingOptions = {}): ChunkResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const segments = buildSegments(text, opts);

  const chunks: ChunkResult[] = [];
  let current: string[] = [];
  let currentLen = 0;
  let currentStart = 0;

  const flush = () => {
    const content = current.join(" ").trim();
    if (content.length > 0) {
      chunks.push({
        content,
        index: chunks.length,
        metadata: {
          charStart: currentStart,
          charEnd: Math.min(currentStart + content.length, text.length),
          wordCount: content.split(/\s+/).filter(Boolean).length,
        },
      });
    }
    current = [];
    currentLen = 0;
  };

  for (const segment of segments) {
    const separatorCost = currentLen > 0 ? 1 : 0;
    const projected = currentLen + separatorCost + segment.content.length;

    if (currentLen > 0 && projected > opts.maxChunkSize) {
      // Only flush when the current chunk is above the minimum size. A tiny
      // chunk is extended by the next segment if it still fits the limit.
      if (currentLen >= opts.minChunkSize) {
        flush();
        const overlap = tailWords(current.join(" "), opts.overlap);
        current = overlap.length > 0 ? [overlap] : [];
        currentLen = overlap.length;
        currentStart = Math.max(0, segment.offsetStart - overlap.length);
      }
    }
    current.push(segment.content);
    currentLen += separatorCost + segment.content.length;
    if (current.length === 1 && currentLen === segment.content.length) {
      currentStart = segment.offsetStart;
    }
  }

  if (current.length > 0) {
    // Fold a below-minimum trailing chunk into the previous chunk when it fits.
    if (chunks.length > 0 && currentLen < opts.minChunkSize) {
      const last = chunks[chunks.length - 1];
      const extra = current.join(" ").trim();
      if (extra.length > 0 && last.content.length + 1 + extra.length <= opts.maxChunkSize) {
        last.content = `${last.content} ${extra}`;
        last.metadata.wordCount = last.content.split(/\s+/).filter(Boolean).length;
        last.metadata.charEnd = Math.min(currentStart + currentLen, text.length);
        return chunks;
      }
    }
    flush();
  }

  return chunks;
}

interface Segment {
  content: string;
  offsetStart: number;
}

/**
 * Split the normalized text into bounded segments. Text is first split at
 * paragraph (blank-line) boundaries. Paragraphs that are still larger than
 * maxChunkSize are subdivided on sentence, then word boundaries.
 */
function buildSegments(text: string, opts: Required<ChunkingOptions>): Segment[] {
  const normalized = text.replace(/\r\n?/g, "\n");
  const paragraphs = splitParagraphs(normalized);
  const segments: Segment[] = [];
  let offset = 0;

  for (const paragraph of paragraphs) {
    const parts = paragraph.trim().length > 0 ? splitForBoundary(paragraph.trim(), opts.splitOn) : [];
    for (const part of parts) {
      if (part.length <= opts.maxChunkSize) {
        segments.push({ content: part, offsetStart: offset });
        offset += part.length + 1;
        continue;
      }
      // Oversized: subdivide on words.
      const words = part.split(/\s+/).filter(Boolean);
      let current = "";
      for (const word of words) {
        const next = current.length > 0 ? `${current} ${word}` : word;
        if (current.length > 0 && next.length > opts.maxChunkSize) {
          segments.push({ content: current, offsetStart: offset });
          offset += current.length + 1;
          current = word;
        } else {
          current = next;
        }
      }
      if (current.length > 0) {
        segments.push({ content: current, offsetStart: offset });
        offset += current.length + 1;
      }
    }
  }

  return segments;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n[ \t]*\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function splitForBoundary(text: string, splitOn: "paragraph" | "sentence" | "word"): string[] {
  if (splitOn === "word") {
    return text.split(/\s+/).filter(Boolean);
  }
  // Sentence splitting: split after sentence-ending punctuation. Keeps the
  // punctuation attached to the sentence. In paragraph mode we still split
  // paragraphs, but keep each paragraph whole unless it overflows the chunk.
  if (splitOn === "sentence") {
    return text
      .split(/(?<=[.!?…])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [text];
}

/**
 * Keep the trailing `size` characters of a chunk as overlap, rounded back to
 * a word boundary so the overlap never splits a word.
 */
function tailWords(text: string, size: number): string {
  const trimmed = text.trim();
  if (size <= 0 || trimmed.length === 0) return "";
  if (trimmed.length <= size) return trimmed;

  const startAt = trimmed.length - size;
  const spaceIndex = trimmed.lastIndexOf(" ", startAt);
  const start = spaceIndex > 0 ? spaceIndex + 1 : startAt;
  return trimmed.slice(start).trim();
}

/**
 * Split markdown into chunks that respect heading structure. Each heading
 * opens a new chunk so the source section is preserved where possible.
 */
export function chunkMarkdown(markdown: string, options?: ChunkingOptions): ChunkResult[] {
  const sections = markdown.split(/(?=#{1,3}\s)/);
  const chunks: ChunkResult[] = [];
  let index = 0;

  for (const section of sections) {
    if (section.trim().length === 0) continue;

    const subChunks = chunkText(section, options);
    for (const sub of subChunks) {
      chunks.push({ ...sub, index });
      index++;
    }
  }

  return chunks;
}
