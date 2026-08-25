import type { AIModelEntity, AIProviderEntity } from "@/lib/db/entities";

import { classifyModel } from "./registry";

export interface DiscoveredModel {
  modelId: string;
  name: string;
  contextWindow: number | null;
  inputCostPerMillion: number | null;
  outputCostPerMillion: number | null;
  modalities?: string[];
}

export interface DiscoveryResult {
  providerId: string;
  models: DiscoveredModel[];
  rawCount: number;
}

/**
 * Parse a numeric cost value from provider APIs. OpenRouter returns strings
 * (e.g. "0.0000000675") per token; normalized to cost per 1M tokens.
 */
function parseCostPerMillion(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  // Per-token cost → per-1M-token cost (OpenRouter /models pricing.prompt)
  return Math.round(n * 1_000_000 * 1e6) / 1e6;
}

/**
 * Fetch the real model list from a provider using its own API.
 * Returns [] on any failure (never throws) — callers surface status separately.
 */
export async function discoverModels(provider: AIProviderEntity): Promise<DiscoveryResult> {
  if (!provider.discoverable) {
    return { providerId: provider.id, models: [], rawCount: 0 };
  }

  const baseUrl = (provider.base_url?.trim() || "").replace(/\/$/, "");
  if (!baseUrl) {
    return { providerId: provider.id, models: [], rawCount: 0 };
  }

  const key = provider.api_key?.trim() || "";
  const endpoint = provider.type === "ollama" ? `${baseUrl}/api/tags` : `${baseUrl}/models`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (key && provider.type !== "ollama") {
      if (provider.type === "anthropic") {
        headers["x-api-key"] = key;
        headers["anthropic-version"] = "2023-06-01";
      } else if (provider.type === "gemini") {
        // Native Gemini API accepts the key via secure header — never as a URL
        // query parameter (query strings leak into access/proxy logs).
        headers["x-goog-api-key"] = key;
      } else {
        headers.Authorization = `Bearer ${key}`;
      }
    }

    const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { providerId: provider.id, models: [], rawCount: 0 };

    const data = await response.json();
    const models = parseModelList(data, provider.type);

    // OpenAI-compatible providers (notably OpenRouter) expose embedding models
    // only through the dedicated /embeddings/models endpoint — the main /models
    // list omits them. Merge any discovered embedding models so the registry
    // captures real embedding models instead of dropping them.
    if (provider.type !== "ollama" && provider.type !== "gemini" && provider.type !== "anthropic") {
      try {
        const embResponse = await fetch(`${baseUrl}/embeddings/models`, {
          headers,
          signal: AbortSignal.timeout(15000),
        });
        if (embResponse.ok) {
          const embData = await embResponse.json();
          const embModels = parseModelList(embData, provider.type);
          const seen = new Set(models.map((m) => m.modelId));
          for (const em of embModels) {
            if (!seen.has(em.modelId)) {
              models.push(em);
              seen.add(em.modelId);
            }
          }
        }
      } catch {
        // Embedding model listing is best-effort; never fail discovery on it.
      }
    }

    return { providerId: provider.id, models, rawCount: models.length };
  } catch {
    return { providerId: provider.id, models: [], rawCount: 0 };
  }
}

/**
 * Parse the raw model list response into a normalized shape.
 * Handles OpenAI-style { data: [{id, context_length, pricing, ...}] },
 * Gemini { models: [{name, displayName, input_token_limit}] },
 * Anthropic { data: [{id, display_name}] } and Ollama { models: [{name}] }.
 */
export function parseModelList(data: unknown, type: AIProviderEntity["type"]): DiscoveredModel[] {
  const models: DiscoveredModel[] = [];

  const typed = data as { data?: unknown; models?: unknown };
  const list = typed.data ?? typed.models;
  if (!Array.isArray(list)) return models;

  if (type === "gemini") {
    for (const m of list as Array<Record<string, unknown>>) {
      const raw = String(m.name ?? "");
      // Gemini returns names like "models/gemini-2.0-flash"
      const modelId = raw.replace(/^models\//, "");
      if (!modelId) continue;
      models.push({
        modelId,
        name: String(m.displayName ?? modelId),
        contextWindow: typeof m.input_token_limit === "number" ? m.input_token_limit : null,
        inputCostPerMillion: null,
        outputCostPerMillion: null,
      });
    }
    return models;
  }

  for (const m of list as Array<Record<string, unknown>>) {
    const modelId = String(m.id ?? m.model ?? m.name ?? "");
    if (!modelId) continue;
    let contextWindow: number | null = null;
    const ctx = m.context_length ?? m.context_window ?? m.max_sequence_length;
    if (typeof ctx === "number" && ctx > 0) contextWindow = ctx;

    // OpenRouter pricing: { prompt: "...", completion: "..." } per token.
    const pricing = (m.pricing ?? {}) as Record<string, unknown>;
    const architecture = (m.architecture ?? {}) as Record<string, unknown>;
    const modalities = Array.isArray(architecture.input_modalities)
      ? (architecture.input_modalities as string[])
      : undefined;

    models.push({
      modelId,
      name: String(m.name ?? m.display_name ?? m.id ?? modelId),
      contextWindow,
      inputCostPerMillion: parseCostPerMillion(pricing.prompt),
      outputCostPerMillion: parseCostPerMillion(pricing.completion),
      modalities,
    });
  }

  return models;
}

/**
 * Build ai_models rows from a discovery result.
 */
export function toModelEntities(result: DiscoveryResult, providerKey: string): Array<Partial<AIModelEntity>> {
  return result.models.map((m) => ({
    provider: result.providerId,
    model_id: m.modelId,
    name: m.name,
    capabilities: classifyModel(m.modelId, providerKey, m.modalities),
    enabled: true,
    context_window: m.contextWindow,
    input_cost_per_million: m.inputCostPerMillion,
    output_cost_per_million: m.outputCostPerMillion,
    source: "discovered" as const,
  }));
}
