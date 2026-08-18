import { createGateway } from "./gateway";
import { type AIProviderAdapter, type EmbeddingResponse } from "./provider";
export async function getEmbeddingAdapter(): Promise<AIProviderAdapter> {
  const gateway = await createGateway();
  const adapter = await gateway.adapterFor("embeddings");
  if (!adapter) {
    throw new Error(
      "No enabled embedding model is configured. Enable an embeddings-capable model in Admin → Settings → AI Models, then set it as the default embedding model in AI Defaults.",
    );
  }
  return adapter;
}

/**
 * Embed a single piece of text. Throws when no embeddings-capable provider
 * is configured.
 */
export async function embedText(text: string): Promise<EmbeddingResponse> {
  const adapter = await getEmbeddingAdapter();
  return adapter.embed(text);
}