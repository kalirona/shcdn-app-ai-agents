import type { AIProvider } from "./provider";
import { db } from "@/lib/db/client";

export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
  sourceTitle: string | null;
  sourceUrl: string | null;
}

export interface VectorSearchOptions {
  embedding: number[];
  workspaceId: string;
  agentId?: string;
  limit?: number;
  threshold?: number;
}

/**
 * Cosine-similarity search over knowledge chunks stored in Directus.
 *
 * Chunks are stored with their embedding as a JSON array on the `embedding`
 * field. Because the app talks to Directus over REST (no direct PostgreSQL
 * connection), similarity is computed client-side over the candidates that
 * belong to the requested workspace and agent. For typical knowledge-base
 * sizes this is fast enough and sidesteps the missing pgvector path.
 */
export async function vectorSearch(options: VectorSearchOptions): Promise<SearchResult[]> {
  const limit = options.limit ?? 5;
  const threshold = options.threshold ?? 0.2;

  if (options.embedding.length === 0) {
    return [];
  }

  const sources = await db.knowledgeSource.getByWorkspace(options.workspaceId);
  const readySources = sources.filter((s) => s.status === "ready" && (!options.agentId || s.agent === options.agentId));

  if (readySources.length === 0) {
    return [];
  }

  const sourceIds = readySources.map((s) => s.id);
  const chunks = await db.knowledgeChunk.getMany({
    filter: { source: { _in: sourceIds } },
    limit: 5000,
    sort: ["index"],
  });

  const sourceByChunk = new Map<string, string | null>();
  const urlByChunk = new Map<string, string | null>();
  for (const source of readySources) {
    sourceByChunk.set(source.id, source.title);
    urlByChunk.set(source.id, source.url);
  }

  const results: SearchResult[] = [];

  for (const chunk of chunks) {
    const embedding = normalizeEmbedding(chunk.embedding);
    if (!embedding || embedding.length === 0) continue;

    const similarity = cosineSimilarity(options.embedding, embedding);
    if (similarity < threshold) continue;

    results.push({
      id: chunk.id,
      content: chunk.content,
      similarity,
      metadata: chunk.metadata ?? {},
      sourceTitle: sourceByChunk.get(chunk.source) ?? null,
      sourceUrl: urlByChunk.get(chunk.source) ?? null,
    });
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, limit);
}

/**
 * Store an embedding for a chunk that already exists in Directus.
 */
export async function storeEmbedding(chunkId: string, embedding: number[], _provider: AIProvider): Promise<void> {
  await db.knowledgeChunk.update(chunkId, { embedding });
}

/**
 * Store embeddings for multiple existing chunks.
 */
export async function batchStoreEmbeddings(
  items: Array<{ chunkId: string; embedding: number[] }>,
  provider: AIProvider,
): Promise<void> {
  for (const item of items) {
    await storeEmbedding(item.chunkId, item.embedding, provider);
  }
}

function normalizeEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? value : null;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}