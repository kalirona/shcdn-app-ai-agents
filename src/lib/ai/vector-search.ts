import type { AIProvider } from "./provider";

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

export async function vectorSearch(options: VectorSearchOptions): Promise<SearchResult[]> {
  const _limit = options.limit ?? 5;
  const _threshold = options.threshold ?? 0.7;

  const _embeddingStr = `[${options.embedding.join(",")}]`;

  const filterConditions = [`workspace_id = '${options.workspaceId}'`];
  if (options.agentId) {
    filterConditions.push(`agent_id = '${options.agentId}'`);
  }
  const whereClause = filterConditions.join(" AND ");

  const _query = `
    SELECT
      kc.id,
      kc.content,
      kc.metadata,
      1 - (kc.embedding <=> $1::vector) as similarity,
      ks.title as source_title,
      ks.url as source_url
    FROM knowledge_chunks kc
    JOIN knowledge_sources ks ON kc.source = ks.id
    WHERE ${whereClause}
      AND ks.status = 'ready'
      AND 1 - (kc.embedding <=> $1::vector) >= $2
    ORDER BY kc.embedding <=> $1::vector
    LIMIT $3
  `;

  // TODO: Execute via Directus or direct PostgreSQL connection
  // For now, return empty (will be implemented with actual DB connection)
  return [];
}

export async function storeEmbedding(_chunkId: string, embedding: number[], _provider: AIProvider): Promise<void> {
  // TODO: Store embedding in Directus/PostgreSQL via pgvector
  const _embeddingStr = `[${embedding.join(",")}]`;
}

export async function batchStoreEmbeddings(
  items: Array<{ chunkId: string; embedding: number[] }>,
  provider: AIProvider,
): Promise<void> {
  for (const item of items) {
    await storeEmbedding(item.chunkId, item.embedding, provider);
  }
}
