import { db } from "../client";
import type { AIDefaultsEntity } from "../entities";

export interface AIDefaultsSafe {
  chatModel: string | null;
  fastModel: string | null;
  visionModel: string | null;
  embeddingModel: string | null;
  imageModel: string | null;
  videoModel: string | null;
  fallbackProvider: string | null;
  fallbackModel: string | null;
  platformSystemPrompt: string | null;
  platformSafetyRules: string | null;
  defaultSystemPrompt: string | null;
}

const EMPTY: AIDefaultsSafe = {
  chatModel: null,
  fastModel: null,
  visionModel: null,
  embeddingModel: null,
  imageModel: null,
  videoModel: null,
  fallbackProvider: null,
  fallbackModel: null,
  platformSystemPrompt: null,
  platformSafetyRules: null,
  defaultSystemPrompt: null,
};

export async function getAIDefaults(): Promise<AIDefaultsSafe> {
  try {
    const defaults = await db.aiDefaults.get();
    if (!defaults?.id) return EMPTY;
    return {
      chatModel: defaults.chat_model,
      fastModel: defaults.fast_model,
      visionModel: defaults.vision_model,
      embeddingModel: defaults.embedding_model,
      imageModel: defaults.image_model,
      videoModel: defaults.video_model,
      fallbackProvider: defaults.fallback_provider,
      fallbackModel: defaults.fallback_model,
      platformSystemPrompt: defaults.platform_system_prompt,
      platformSafetyRules: defaults.platform_safety_rules,
      defaultSystemPrompt: defaults.default_system_prompt,
    };
  } catch {
    return EMPTY;
  }
}

export async function updateAIDefaults(data: Partial<AIDefaultsEntity>): Promise<AIDefaultsSafe | null> {
  try {
    await db.aiDefaults.update(data);
    return await getAIDefaults();
  } catch {
    return null;
  }
}
