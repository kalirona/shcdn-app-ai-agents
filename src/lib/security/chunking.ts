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
  overlap?: number;
  splitOn?: "paragraph" | "sentence" | "word";
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  maxChunkSize: 1000,
  overlap: 100,
  splitOn: "paragraph",
};

export function chunkText(text: string, options: ChunkingOptions = {}): ChunkResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cleanText = text.replace(/\s+/g, " ").trim();

  if (cleanText.length <= opts.maxChunkSize) {
    return [
      {
        content: cleanText,
        index: 0,
        metadata: { charStart: 0, charEnd: cleanText.length, wordCount: cleanText.split(" ").length },
      },
    ];
  }

  const chunks: ChunkResult[] = [];
  const separators = getSeparators(opts.splitOn);
  const segments = splitText(cleanText, separators);

  let currentChunk = "";
  let currentStart = 0;
  let index = 0;

  for (const segment of segments) {
    if (currentChunk.length + segment.length > opts.maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index,
        metadata: {
          charStart: currentStart,
          charEnd: currentStart + currentChunk.length,
          wordCount: currentChunk.split(" ").length,
        },
      });
      index++;

      const overlapText = getOverlapText(currentChunk, opts.overlap);
      currentChunk = overlapText + segment;
      currentStart = currentStart + currentChunk.length - overlapText.length - segment.length + segment.length;
    } else {
      currentChunk += segment;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      index,
      metadata: {
        charStart: currentStart,
        charEnd: currentStart + currentChunk.length,
        wordCount: currentChunk.split(" ").length,
      },
    });
  }

  return chunks;
}

function getSeparators(splitOn: "paragraph" | "sentence" | "word"): RegExp {
  switch (splitOn) {
    case "paragraph":
      return /\n\s*\n/;
    case "sentence":
      return /(?<=[.!?])\s+/;
    case "word":
      return /\s+/;
  }
}

function splitText(text: string, separator: RegExp): string[] {
  return text.split(separator).filter((s) => s.trim().length > 0);
}

function getOverlapText(text: string, overlapSize: number): string {
  if (overlapSize <= 0) return "";
  if (text.length <= overlapSize) return text;

  const overlapStart = text.length - overlapSize;
  const spaceIndex = text.indexOf(" ", overlapStart);

  if (spaceIndex === -1) {
    return text.slice(overlapStart);
  }

  return `${text.slice(spaceIndex + 1)} `;
}

export function chunkMarkdown(markdown: string, options?: ChunkingOptions): ChunkResult[] {
  const sections = markdown.split(/(?=#{1,3}\s)/);
  const chunks: ChunkResult[] = [];
  let index = 0;

  for (const section of sections) {
    if (section.trim().length === 0) continue;

    if (section.length <= (options?.maxChunkSize ?? 1000)) {
      chunks.push({
        content: section.trim(),
        index,
        metadata: {
          charStart: markdown.indexOf(section),
          charEnd: markdown.indexOf(section) + section.length,
          wordCount: section.split(" ").length,
        },
      });
      index++;
    } else {
      const subChunks = chunkText(section, options);
      for (const sub of subChunks) {
        chunks.push({ ...sub, index });
        index++;
      }
    }
  }

  return chunks;
}
