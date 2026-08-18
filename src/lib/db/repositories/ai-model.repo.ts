import { db } from "../client";
import type { AICapability, AIModelEntity } from "../entities";
import { getAllProviders } from "./ai-provider.repo";

export interface AIModelSafe {
  id: string;
  provider: string;
  providerKey: string;
  providerName: string;
  modelId: string;
  name: string;
  capabilities: AICapability[];
  enabled: boolean;
  contextWindow: number | null;
  inputCostPerMillion: number | null;
  outputCostPerMillion: number | null;
  source: "discovered" | "manual";
}

export async function getAllModels(): Promise<AIModelEntity[]> {
  try {
    return await db.aiModel.getMany({ sort: ["provider", "model_id"], limit: -1 });
  } catch {
    return [];
  }
}

export async function getModelCounts(): Promise<{
  total: number;
  enabled: number;
  byProvider: Record<string, number>;
}> {
  const models = await getAllModels();
  const byProvider: Record<string, number> = {};
  for (const m of models) {
    byProvider[m.provider] = (byProvider[m.provider] ?? 0) + 1;
  }
  return {
    total: models.length,
    enabled: models.filter((m) => m.enabled).length,
    byProvider,
  };
}

export async function getModelsByProvider(providerId: string): Promise<AIModelEntity[]> {
  try {
    return await db.aiModel.getByProvider(providerId);
  } catch {
    return [];
  }
}

export async function getModelById(id: string): Promise<AIModelEntity | null> {
  try {
    return await db.aiModel.getById(id);
  } catch {
    return null;
  }
}

export async function createModel(data: {
  provider: string;
  model_id: string;
  name: string;
  capabilities?: AICapability[];
  enabled?: boolean;
  context_window?: number | null;
  input_cost_per_million?: number | null;
  output_cost_per_million?: number | null;
  source?: "discovered" | "manual";
}): Promise<AIModelEntity> {
  return db.aiModel.create({
    provider: data.provider,
    model_id: data.model_id,
    name: data.name,
    capabilities: data.capabilities ?? ["chat"],
    enabled: data.enabled ?? true,
    context_window: data.context_window ?? null,
    input_cost_per_million: data.input_cost_per_million ?? null,
    output_cost_per_million: data.output_cost_per_million ?? null,
    source: data.source ?? "discovered",
  });
}

export async function updateModel(id: string, data: Partial<AIModelEntity>): Promise<AIModelEntity | null> {
  try {
    return await db.aiModel.update(id, data);
  } catch {
    return null;
  }
}

export async function deleteModel(id: string): Promise<boolean> {
  try {
    await db.aiModel.delete(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete all models for a provider (used when re-syncing the registry).
 */
export async function deleteModelsByProvider(providerId: string): Promise<void> {
  const models = await getModelsByProvider(providerId);
  for (const model of models) {
    await db.aiModel.delete(model.id);
  }
}

/**
 * Build safe model rows joined with provider metadata.
 */
export async function getAllModelsSafe(): Promise<AIModelSafe[]> {
  const [models, providers] = await Promise.all([getAllModels(), getAllProviders()]);
  const providerMap = new Map(providers.map((p) => [p.id, p]));
  return models.map((m) => {
    const provider = providerMap.get(m.provider);
    return {
      id: m.id,
      provider: m.provider,
      providerKey: provider?.provider_key ?? m.provider,
      providerName: provider?.name ?? m.provider,
      modelId: m.model_id,
      name: m.name,
      capabilities: Array.isArray(m.capabilities) ? m.capabilities : ["chat"],
      enabled: m.enabled,
      contextWindow: m.context_window,
      inputCostPerMillion: m.input_cost_per_million ?? null,
      outputCostPerMillion: m.output_cost_per_million ?? null,
      source: m.source,
    };
  });
}

/**
 * Gateway-facing view: enabled models belonging to enabled providers.
 * Used by the gateway to enforce the platform model allowlist.
 */
export interface EnabledModelEntry {
  provider: string;
  providerKey: string;
  modelId: string;
  capabilities: AICapability[];
  inputCostPerMillion: number | null;
  outputCostPerMillion: number | null;
}

export async function getEnabledModelEntries(): Promise<EnabledModelEntry[]> {
  const [models, providers] = await Promise.all([getAllModels(), getAllProviders()]);
  const enabledProviders = new Map(providers.filter((p) => p.enabled).map((p) => [p.id, p]));
  return models
    .filter((m) => m.enabled)
    .map((m) => {
      const provider = enabledProviders.get(m.provider);
      const capabilities: AICapability[] = Array.isArray(m.capabilities) ? m.capabilities : ["chat"];
      return {
        provider: m.provider,
        providerKey: provider?.provider_key ?? m.provider,
        modelId: m.model_id,
        capabilities,
        inputCostPerMillion: m.input_cost_per_million ?? null,
        outputCostPerMillion: m.output_cost_per_million ?? null,
      };
    })
    .filter((m) => enabledProviders.has(m.provider));
}
