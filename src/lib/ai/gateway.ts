import type { AICapability, AIProviderEntity } from "@/lib/db/entities";
import type { AIDefaultsSafe } from "@/lib/db/repositories/ai-defaults.repo";
import { getAIDefaults } from "@/lib/db/repositories/ai-defaults.repo";
import { getEnabledModelEntries, type EnabledModelEntry } from "@/lib/db/repositories/ai-model.repo";
import { getEnabledProvidersWithKeys } from "@/lib/db/repositories/ai-provider.repo";
import { db } from "@/lib/db/client";

import {
  type AIProvider,
  type AIProviderAdapter,
  type ChatOptions,
  type ChatResponse,
  type AITool,
  createAIProvider,
} from "./provider";
import { toolRegistry } from "@/lib/tools";

export type GatewayPurpose = "chat" | "fast" | "vision" | "embeddings" | "image" | "video";

export interface RuntimeModelConfig {
  providerKey: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  type: AIProviderEntity["type"];
}

export interface GatewayResolution {
  provider: AIProviderEntity;
  modelId: string;
}

export interface Gateway {
  /** Highest-priority enabled provider + a model for the given purpose. */
  resolve(purpose?: GatewayPurpose): Promise<GatewayResolution | null>;
  /** Adapter for a specific provider config. */
  adapter(provider: AIProviderEntity): AIProviderAdapter;
  /** Adapter resolved for a purpose (embeddings uses the embedding default model). */
  adapterFor(purpose?: GatewayPurpose): Promise<AIProviderAdapter | null>;
  chat(options: ChatOptions & { purpose?: GatewayPurpose }): Promise<ChatResponse>;
  /** Raw config for a provider (used by runtime code paths). */
  configFor(purpose?: GatewayPurpose): Promise<RuntimeModelConfig | null>;
}

/**
 * Resolve the model id for a purpose from the platform defaults.
 */
export async function resolveDefaultModel(defaults: AIDefaultsSafe, purpose: GatewayPurpose): Promise<string | null> {
  switch (purpose) {
    case "chat":
      return defaults.chatModel;
    case "fast":
      return defaults.fastModel;
    case "vision":
      return defaults.visionModel;
    case "embeddings":
      return defaults.embeddingModel;
    case "image":
      return defaults.imageModel;
    case "video":
      return defaults.videoModel;
  }
}

/**
 * Given a provider and a requested model id, produce the config the
 * transport layer needs (base url, key, type).
 */
export function providerRuntimeConfig(provider: AIProviderEntity, modelId?: string | null): RuntimeModelConfig {
  return {
    providerKey: provider.provider_key,
    modelId: modelId ?? provider.default_model ?? "",
    baseUrl: (provider.base_url?.trim() ?? "").replace(/\/$/, ""),
    apiKey: provider.api_key?.trim() ?? "",
    type: provider.type,
  };
}

/**
 * The platform AI gateway.
 *
 * Resolution order:
 *   1. Enabled providers (sorted by priority).
 *   2. A model id from ai_defaults for the requested purpose, else the
 *      provider's default_model, else any model currently in the registry.
 *   3. Falls back to null when no provider is enabled/configured so the
 *      caller can use the legacy env-driven path.
 */
/**
 * Map gateway purposes to required capabilities for provider selection.
 */
function purposeToCapability(purpose: GatewayPurpose): "chat" | "vision" | "embeddings" | "image" | "video" {
  switch (purpose) {
    case "chat":
    case "fast":
      return "chat";
    case "vision":
      return "vision";
    case "embeddings":
      return "embeddings";
    case "image":
      return "image";
    case "video":
      return "video";
  }
}

export async function createGateway(): Promise<Gateway> {
  const [providers, defaults, enabledModels] = await Promise.all([
    getEnabledProvidersWithKeys(),
    getAIDefaults(),
    getEnabledModelEntries(),
  ]);

  /**
   * Enforce the model allowlist. A model may only be used when:
   *   - its provider is enabled (providers list is already filtered to enabled)
   *   - it exists in the ai_models registry
   *   - it is enabled in the registry
   *   - it belongs to the selected provider
   *   - its capabilities cover the requested purpose
   */
  function allowedModel(
    modelId: string | null | undefined,
    providerId: string,
    requiredCapability: AICapability,
  ): boolean {
    if (!modelId) return false;
    const entry = enabledModels.find((m) => m.modelId === modelId && m.provider === providerId);
    if (!entry) return false;
    return entry.capabilities.includes(requiredCapability);
  }

  /**
   * Resolve a provider + model for a purpose while honoring the allowlist.
   * Returns null when no allowed combination exists.
   */
  async function resolve(purpose: GatewayPurpose = "chat"): Promise<GatewayResolution | null> {
    if (providers.length === 0) return null;

    const requiredCapability = purposeToCapability(purpose);
    const targetModel = await resolveDefaultModel(defaults, purpose);

    // 1) The platform default model, if the owning enabled provider allows it.
    if (targetModel) {
      for (const provider of providers) {
        if (allowedModel(targetModel, provider.id, requiredCapability)) {
          return { provider, modelId: targetModel };
        }
      }
    }

    // 2) Any enabled model on an enabled provider that covers the capability,
    //    walking providers in priority order so priority still applies — but
    //    never picking a disabled model.
    for (const provider of providers) {
      const candidate = enabledModels.find(
        (m) => m.provider === provider.id && m.capabilities.includes(requiredCapability),
      );
      if (candidate) {
        return { provider, modelId: candidate.modelId };
      }
    }

    // 3) The provider's configured default_model if it passes the allowlist.
    for (const provider of providers) {
      if (allowedModel(provider.default_model, provider.id, requiredCapability)) {
        return { provider, modelId: provider.default_model as string };
      }
    }

    return null;
  }

  return {
    resolve,
    configFor: async (purpose) => {
      const resolution = await resolve(purpose);
      if (!resolution) return null;
      return providerRuntimeConfig(resolution.provider, resolution.modelId);
    },
    adapter(provider) {
      return createProviderAdapter(provider);
    },
    adapterFor: async (purpose = "chat") => {
      const resolution = await resolve(purpose);
      if (!resolution) return null;
      const runtime = providerRuntimeConfig(resolution.provider, resolution.modelId);
      return createAIProvider(runtime.providerKey as AIProvider, {
        baseUrl: runtime.baseUrl,
        apiKey: runtime.apiKey,
        defaultModel: runtime.modelId || undefined,
        embeddingModel: purpose === "embeddings" ? runtime.modelId || undefined : undefined,
      });
    },
chat: async (options) => {
      const purpose = options.purpose ?? "chat";
      const requiredCapability = purposeToCapability(purpose);

      // Resolve agent tools if agent ID is provided
      let tools: AITool[] = [];
      if (options.agent) {
        try {
          const agent = await db.agent.getById(options.agent);
          if (agent?.allowed_tools && agent.allowed_tools.length > 0) {
            tools = resolveAgentTools(agent.allowed_tools);
          }
        } catch {
          // Agent not found, proceed without tools
        }
      }

      // A client-supplied model id is NEVER trusted: it must resolve against the
      // platform allowlist (enabled model on an enabled provider with the right
      // capability). Otherwise reject the request.
      if (options.model) {
        const entry = enabledModels.find(
          (m) => m.modelId === options.model && m.capabilities.includes(requiredCapability),
        );
        if (!entry) {
          throw new Error(
            `Model "${options.model}" is not allowed for ${purpose}. ` +
              `Enable it in Admin → Settings → AI Models or choose a different model.`,
          );
        }
        const provider = providers.find((p) => p.id === entry.provider);
        if (!provider) {
          throw new Error(`Model "${options.model}" belongs to a disabled provider.`);
        }
        const adapter = createProviderAdapter(provider);
        const response = await adapter.chat({ ...options, model: options.model, tools });
        await logCost(provider, options.model, options, response, enabledModels);
        return response;
      }

      const resolution = await resolve(purpose);
      if (!resolution) {
        throw new Error(
          `No AI provider configured for ${purpose}. ` +
          `Go to Admin → Settings → AI Providers to add and enable a provider ` +
          `with ${requiredCapability} capability, then set a default model in AI Defaults.`
        );
      }
      const adapter = createProviderAdapter(resolution.provider);
      const response = await adapter.chat({ ...options, model: resolution.modelId || options.model, tools });
      await logCost(resolution.provider, resolution.modelId, options, response, enabledModels);
      return response;
    },
  };
}

async function logCost(
  provider: AIProviderEntity,
  model: string,
  options: ChatOptions & { purpose?: GatewayPurpose },
  response: ChatResponse,
  enabledModels: EnabledModelEntry[],
): Promise<void> {
  try {
    const enabledModel = enabledModels.find((m) => m.modelId === model);
    // Per-model pricing (from discovery) is the source of truth; fall back to
    // the provider-wide defaults when the model has no known pricing.
    const inputCostPerM = enabledModel?.inputCostPerMillion ?? provider.input_cost_per_million ?? 0;
    const outputCostPerM = enabledModel?.outputCostPerMillion ?? provider.output_cost_per_million ?? 0;
    const inputTokens = response.usage?.promptTokens ?? 0;
    const outputTokens = response.usage?.completionTokens ?? 0;
    const inputCost = (inputTokens / 1_000_000) * inputCostPerM;
    const outputCost = (outputTokens / 1_000_000) * outputCostPerM;
    const totalCost = inputCost + outputCost;

    await db.costLog.create({
      provider: provider.provider_key,
      model,
      purpose: options.purpose ?? "chat",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      input_cost: inputCost,
      output_cost: outputCost,
      total_cost: totalCost,
      workspace: options.workspace ?? null,
      agent: options.agent ?? null,
      user: options.user ?? null,
      date_updated: new Date().toISOString(),
    });
  } catch (costError) {
    console.error("Failed to log AI cost:", costError);
  }
}

/**
 * Resolve tool definitions for an agent based on their allowed_tools.
 */
export function resolveAgentTools(allowedTools: string[]): AITool[] {
  const tools: AITool[] = [];
  for (const toolName of allowedTools) {
    const definition = toolRegistry.get(toolName);
    if (definition) {
      // Convert Zod schema to JSON schema object for OpenAI function calling
      const parameters = definition.parameters as unknown as Record<string, unknown>;
      tools.push({
        type: "function",
        function: {
          name: definition.name,
          description: definition.description,
          parameters,
        },
      });
    }
  }
  return tools;
}

/**
 * Build an AIProviderAdapter for any provider type supported by the platform.
 * Gemini is served through its OpenAI-compatible endpoint inside provider.ts.
 */
export function createProviderAdapter(provider: AIProviderEntity): AIProviderAdapter {
  const runtime = providerRuntimeConfig(provider);
  return createAIProvider(runtime.providerKey as AIProvider, {
    baseUrl: runtime.baseUrl,
    apiKey: runtime.apiKey,
    defaultModel: runtime.modelId || undefined,
  });
}
