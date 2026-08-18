import { z } from "zod";

const AI_PROVIDER_KEYS = [
  "openrouter",
  "gemini",
  "openai",
  "anthropic",
  "glm",
  "together",
  "groq",
  "ollama",
  "custom",
] as const;

const AI_PROVIDER_TYPES = ["openai", "anthropic", "gemini", "ollama", "openrouter", "glm", "together", "groq", "custom"] as const;

const AI_CAPABILITY_VALUES = ["chat", "vision", "embeddings", "image", "video"] as const;

const capabilitiesSchema = z.array(z.enum(AI_CAPABILITY_VALUES)).max(5, "Too many capabilities.").default(["chat"]);

export const saveProviderSchema = z.object({
  id: z.coerce.string().optional(),
  providerKey: z.enum(AI_PROVIDER_KEYS),
  name: z.string().trim().min(1, "Provider name is required.").max(128),
  type: z.enum(AI_PROVIDER_TYPES),
  apiKey: z.string().trim().max(512, "API key must be 512 characters or less.").optional().nullable(),
  baseUrl: z.string().trim().max(512, "Base URL must be 512 characters or less.").optional().nullable(),
  enabled: z.boolean().default(false),
  priority: z.number().int().min(0).max(9999).default(100),
  defaultModel: z.string().trim().max(256, "Default model must be 256 characters or less.").optional().nullable(),
  capabilities: capabilitiesSchema,
  discoverable: z.boolean().default(true),
  inputCostPerMillion: z.number().min(0).max(10000).optional().nullable(),
  outputCostPerMillion: z.number().min(0).max(10000).optional().nullable(),
});

export const providerIdSchema = z.object({
  providerId: z.coerce.string().min(1, "Provider ID is required."),
});

export const toggleProviderSchema = z.object({
  providerId: z.coerce.string().min(1, "Provider ID is required."),
  enabled: z.boolean(),
});

export const reorderProvidersSchema = z.object({
  order: z.array(z.coerce.string().min(1)).min(1, "At least one provider is required."),
});

export const modelIdSchema = z.object({
  modelId: z.coerce.string().min(1, "Model ID is required."),
});

export const toggleModelSchema = z.object({
  modelId: z.coerce.string().min(1, "Model ID is required."),
  enabled: z.boolean(),
});

export const updateModelCapabilitiesSchema = z.object({
  modelId: z.coerce.string().min(1, "Model ID is required."),
  capabilities: capabilitiesSchema,
});

export const saveAIDefaultsSchema = z.object({
  chatModel: z.string().trim().max(256).optional().nullable(),
  fastModel: z.string().trim().max(256).optional().nullable(),
  visionModel: z.string().trim().max(256).optional().nullable(),
  embeddingModel: z.string().trim().max(256).optional().nullable(),
  imageModel: z.string().trim().max(256).optional().nullable(),
  videoModel: z.string().trim().max(256).optional().nullable(),
  fallbackProvider: z.enum(AI_PROVIDER_KEYS).optional().nullable(),
  fallbackModel: z.string().trim().max(256).optional().nullable(),
  platformSystemPrompt: z.string().max(20000).optional().nullable(),
  platformSafetyRules: z.string().max(20000).optional().nullable(),
  defaultSystemPrompt: z.string().max(20000).optional().nullable(),
});

export const deleteProviderSchema = z.object({
  providerId: z.string().min(1, "Provider ID is required."),
});

export type SaveProviderInput = z.infer<typeof saveProviderSchema>;
export type SaveAIDefaultsInput = z.infer<typeof saveAIDefaultsSchema>;
