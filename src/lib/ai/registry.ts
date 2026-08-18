import type { AICapability, AIProviderKey, AIProviderType } from "@/lib/db/entities";

export interface ProviderDefinition {
  key: AIProviderKey;
  name: string;
  type: AIProviderType;
  defaultBaseUrl: string;
  docsUrl?: string;
  /** HTTP auth scheme used for connection tests / discovery. */
  auth: "bearer" | "x-api-key" | "query-key" | "none";
}

export const AI_CAPABILITIES: { value: AICapability; label: string }[] = [
  { value: "chat", label: "Chat" },
  { value: "vision", label: "Vision" },
  { value: "embeddings", label: "Embeddings" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
];

export const PROVIDER_DEFINITIONS: Record<AIProviderKey, ProviderDefinition> = {
  openrouter: {
    key: "openrouter",
    name: "OpenRouter",
    type: "openai",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    docsUrl: "https://openrouter.ai/docs",
    auth: "bearer",
  },
  gemini: {
    key: "gemini",
    name: "Google Gemini",
    type: "gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    auth: "query-key",
  },
  openai: {
    key: "openai",
    name: "OpenAI",
    type: "openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    docsUrl: "https://platform.openai.com/docs",
    auth: "bearer",
  },
  anthropic: {
    key: "anthropic",
    name: "Anthropic",
    type: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    docsUrl: "https://docs.anthropic.com",
    auth: "x-api-key",
  },
  glm: {
    key: "glm",
    name: "GLM",
    type: "openai",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    docsUrl: "https://open.bigmodel.cn/dev/howuse/model",
    auth: "bearer",
  },
  together: {
    key: "together",
    name: "Together AI",
    type: "openai",
    defaultBaseUrl: "https://api.together.xyz/v1",
    docsUrl: "https://docs.together.ai",
    auth: "bearer",
  },
  groq: {
    key: "groq",
    name: "Groq",
    type: "openai",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    docsUrl: "https://console.groq.com/docs",
    auth: "bearer",
  },
  ollama: {
    key: "ollama",
    name: "Ollama",
    type: "ollama",
    defaultBaseUrl: "http://localhost:11434",
    docsUrl: "https://ollama.com/library",
    auth: "none",
  },
  custom: {
    key: "custom",
    name: "Custom",
    type: "openai",
    defaultBaseUrl: "",
    auth: "bearer",
  },
};

export const PROVIDER_KEYS = Object.keys(PROVIDER_DEFINITIONS) as AIProviderKey[];

export function resolveProvider(key: string): ProviderDefinition | null {
  return PROVIDER_DEFINITIONS[key as AIProviderKey] ?? null;
}

/**
 * Classify a model id into capabilities using provider-agnostic heuristics.
 * A model is always at least a chat model unless it is an embeddings-only id.
 *
 * When the provider returns structured modality info (e.g. OpenRouter
 * `architecture.input_modalities`), those hints take precedence for vision /
 * image / video classification.
 */
export function classifyModel(
  modelId: string,
  providerKey?: string,
  modalities?: string[],
): AICapability[] {
  const id = modelId.toLowerCase();

  // Embeddings-only models
  if (
    /embed/i.test(id) ||
    /ada-002/.test(id) ||
    /bge(-|_)/.test(id) ||
    /^all-mpnet/.test(id) ||
    /sentence-transformers|text-embedding|embed-content/.test(id)
  ) {
    return ["embeddings"];
  }

  const capabilities: AICapability[] = ["chat"];

  if (Array.isArray(modalities) && modalities.length > 0) {
    const mods = modalities.map((m) => m.toLowerCase());
    if (mods.includes("image")) {
      capabilities.push("vision");
      if (/text-to-image|image-to-image|generation|imagen|dall-e|flux|stable/.test(id)) {
        capabilities.push("image");
      }
    }
    if (mods.some((m) => /video|text-to-video/.test(m))) {
      capabilities.push("video");
    }
    return capabilities;
  }

  // Vision / multimodal
  if (
    /vision|multimodal/.test(id) ||
    /gpt-4o/.test(id) ||
    /gpt-4-turbo/.test(id) ||
    /-4o-/.test(id) ||
    /gemini-.*(pro|flash|ultra)/.test(id) ||
    /claude-.*-sonnet/.test(id) ||
    /claude-.*-opus/.test(id) ||
    /gemini-2/.test(id) ||
    providerKey === "gemini"
  ) {
    capabilities.push("vision");
  }

  // Image generation
  if (/dall-e|imagen|imagegen|flux|stable-diffusion|sdxl|sora-image|image-1|image-generat/.test(id)) {
    capabilities.push("image");
  }

  // Video generation
  if (/sora|veo|kling|runway|pika|vidto|video-/.test(id)) {
    capabilities.push("video");
  }

  return capabilities;
}

/**
 * Normalize a model id into a human-friendly display name.
 */
export function modelDisplayName(modelId: string): string {
  const clean = modelId.trim();
  if (!clean) return clean;
  // Turn "provider/name-v1" style ids into a readable label, keep original casing.
  return clean;
}
