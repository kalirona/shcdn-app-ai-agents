"use server";

import { revalidatePath } from "next/cache";

import { discoverModels, toModelEntities, parseModelList } from "@/lib/ai/discovery";
import { resolveProvider } from "@/lib/ai/registry";
import { requirePlatformAccess } from "@/lib/auth/platform-access";
import {
  deleteProviderSchema,
  modelIdSchema,
  providerIdSchema,
  reorderProvidersSchema,
  type SaveAIDefaultsInput,
  type SaveProviderInput,
  saveAIDefaultsSchema,
  saveProviderSchema,
  toggleModelSchema,
  toggleProviderSchema,
  updateModelCapabilitiesSchema,
} from "@/lib/auth/schemas/ai.schema";
import { db } from "@/lib/db/client";
import { getAIDefaults, updateAIDefaults } from "@/lib/db/repositories/ai-defaults.repo";
import {
  deleteModel,
  deleteModelsByProvider,
  getAllModelsSafe,
  getModelById,
  updateModel,
} from "@/lib/db/repositories/ai-model.repo";
import {
  createProvider,
  deleteProvider,
  getAllProvidersSafe,
  getProviderById,
  getProviderWithKey,
  updateProvider,
} from "@/lib/db/repositories/ai-provider.repo";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getAdminAIProviders() {
  await requirePlatformAccess("platform:settings:manage");
  return getAllProvidersSafe();
}

export async function getAdminAIModels() {
  await requirePlatformAccess("platform:settings:manage");
  return getAllModelsSafe();
}

export async function getAdminAIDefaults() {
  await requirePlatformAccess("platform:settings:manage");
  return getAIDefaults();
}

// ---------------------------------------------------------------------------
// Provider mutations
// ---------------------------------------------------------------------------

export async function saveProvider(input: SaveProviderInput): Promise<ActionResult<{ id: string }>> {
  await requirePlatformAccess("platform:settings:manage");

  const parsed = saveProviderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const data = parsed.data;

  // Built-in providers ship with a known API base URL. If the admin left the
  // field blank, fall back to the registry default so connection tests and
  // model discovery work without manual URL entry.
  const knownBaseUrl = resolveProvider(data.providerKey)?.defaultBaseUrl ?? "";

  try {
    if (data.id) {
      const existing = await getProviderById(data.id);
      if (!existing) return { ok: false, error: "Provider not found." };

      const patch: Record<string, unknown> = {
        name: data.name,
        type: data.type,
        base_url: data.baseUrl?.trim() || knownBaseUrl || null,
        enabled: data.enabled,
        priority: data.priority,
        default_model: data.defaultModel?.trim() || null,
        capabilities: data.capabilities,
        discoverable: data.discoverable,
        input_cost_per_million: data.inputCostPerMillion ?? null,
        output_cost_per_million: data.outputCostPerMillion ?? null,
      };

      // Only overwrite the API key when a new non-empty value is provided.
      if (data.apiKey?.trim()) {
        patch.api_key = data.apiKey.trim();
      }

      await updateProvider(data.id, patch as Parameters<typeof updateProvider>[1]);
    } else {
      await createProvider({
        provider_key: data.providerKey,
        name: data.name,
        type: data.type,
        api_key: data.apiKey?.trim() || null,
        base_url: data.baseUrl?.trim() || knownBaseUrl || null,
        enabled: data.enabled,
        priority: data.priority,
        default_model: data.defaultModel?.trim() || null,
        capabilities: data.capabilities,
        discoverable: data.discoverable,
        input_cost_per_million: data.inputCostPerMillion ?? null,
        output_cost_per_million: data.outputCostPerMillion ?? null,
      });
    }

    revalidatePath("/admin/settings");
    return { ok: true, data: { id: data.id ?? "" } };
  } catch (error) {
    console.error("Failed to save provider:", error instanceof Error ? error.message : error);
    // Surface the static validation message from the api-key policy (safe to
    // show); everything else stays generic.
    if (error instanceof Error && error.message === "An API key is required for this provider type.") {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Failed to save provider." };
  }
}

export async function toggleProviderEnabled(input: {
  providerId: string;
  enabled: boolean;
}): Promise<ActionResult<null>> {
  await requirePlatformAccess("platform:settings:manage");

  const parsed = toggleProviderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const provider = await getProviderById(parsed.data.providerId);
    if (!provider) return { ok: false, error: "Provider not found." };

    await updateProvider(provider.id, { enabled: parsed.data.enabled });
    revalidatePath("/admin/settings");
    return { ok: true, data: null };
  } catch (error) {
    console.error("Failed to toggle provider:", error);
    return { ok: false, error: "Failed to update provider." };
  }
}

export async function removeProvider(input: { providerId: string }): Promise<ActionResult<null>> {
  await requirePlatformAccess("platform:settings:manage");

  const parsed = deleteProviderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const provider = await getProviderById(parsed.data.providerId);
    if (!provider) return { ok: false, error: "Provider not found." };

    // Built-in providers cannot be deleted (they can be disabled).
    if (resolveProvider(provider.provider_key)) {
      return { ok: false, error: "Built-in providers cannot be removed. Disable them instead." };
    }

    await deleteModelsByProvider(provider.id);
    await deleteProvider(provider.id);
    revalidatePath("/admin/settings");
    return { ok: true, data: null };
  } catch (error) {
    console.error("Failed to remove provider:", error);
    return { ok: false, error: "Failed to remove provider." };
  }
}

export async function reorderProviders(input: { order: string[] }): Promise<ActionResult<null>> {
  await requirePlatformAccess("platform:settings:manage");

  const parsed = reorderProvidersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const providers = await getAllProvidersSafe();
    const byId = new Map(providers.map((p) => [p.id, p]));
    for (let i = 0; i < parsed.data.order.length; i += 1) {
      const id = parsed.data.order[i];
      const provider = byId.get(id);
      if (!provider) continue;
      await updateProvider(id, { priority: i + 1 });
    }
    revalidatePath("/admin/settings");
    return { ok: true, data: null };
  } catch (error) {
    console.error("Failed to reorder providers:", error);
    return { ok: false, error: "Failed to reorder providers." };
  }
}

/**
 * Test a provider connection by calling its model-list endpoint (a cheap
 * authenticated request). Updates status / last_tested_at / last_error.
 */
export async function testProviderConnection(input: {
  providerId: string;
}): Promise<ActionResult<{ status: string; lastError: string | null; modelCount: number }>> {
  await requirePlatformAccess("platform:settings:manage");

  const parsed = providerIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    // Use the decrypted key for the actual connection test.
    const provider = await getProviderWithKey(parsed.data.providerId);
    if (!provider) return { ok: false, error: "Provider not found." };

    if (!provider.api_key?.trim() && provider.type !== "ollama") {
      await updateProvider(provider.id, {
        status: "error",
        last_tested_at: new Date().toISOString(),
        last_error: "No API key configured.",
      });
      revalidatePath("/admin/settings");
      return { ok: false, error: "No API key configured for this provider." };
    }

    const baseUrl = (provider.base_url?.trim() || "").replace(/\/$/, "");
    if (!baseUrl) {
      await updateProvider(provider.id, {
        status: "error",
        last_tested_at: new Date().toISOString(),
        last_error: "No base URL configured.",
      });
      revalidatePath("/admin/settings");
      return { ok: false, error: "No base URL configured for this provider." };
    }

    const key = provider.api_key?.trim() || "";
    const endpoint = provider.type === "ollama" ? `${baseUrl}/api/tags` : `${baseUrl}/models`;

    let response: Response;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (key && provider.type !== "ollama") {
        if (provider.type === "anthropic") {
          headers["x-api-key"] = key;
          headers["anthropic-version"] = "2023-06-01";
        } else if (provider.type === "gemini") {
          // Native Gemini API accepts the key via secure header — never as a
          // URL query parameter (query strings leak into access/proxy logs).
          headers["x-goog-api-key"] = key;
        } else {
          headers.Authorization = `Bearer ${key}`;
        }
      }
      response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(15000) });
    } catch (fetchError) {
      const errMsg = fetchError instanceof Error ? fetchError.message : "Network error";
      await updateProvider(provider.id, {
        status: "error",
        last_tested_at: new Date().toISOString(),
        last_error: `Connection failed: ${errMsg}`,
      });
      revalidatePath("/admin/settings");
      return { ok: false, error: `Connection failed: ${errMsg}` };
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      await updateProvider(provider.id, {
        status: "error",
        last_tested_at: new Date().toISOString(),
        last_error: `HTTP ${response.status}: ${errorBody}`,
      });
      revalidatePath("/admin/settings");
      return { ok: false, error: `Provider test failed (HTTP ${response.status}): ${errorBody}` };
    }

    const data = await response.json().catch(() => ({}));
    const models = parseModelList(data, provider.type);
    const ok = models.length > 0;

    await updateProvider(provider.id, {
      status: ok ? "ok" : "error",
      last_tested_at: new Date().toISOString(),
      last_error: ok ? null : "Connection succeeded but returned no models.",
    });

    revalidatePath("/admin/settings");
    return {
      ok: true,
      data: {
        status: ok ? "ok" : "error",
        lastError: ok ? null : "Connection succeeded but returned no models.",
        modelCount: models.length,
      },
    };
  } catch (error) {
    console.error("Failed to test provider:", error);
    return { ok: false, error: "Failed to test provider." };
  }
}

/**
 * Sync the model registry from a provider's real model list.
 * Replaces the provider's discovered models with the freshly fetched list.
 */
export async function syncProviderModels(input: { providerId: string }): Promise<ActionResult<{ added: number }>> {
  await requirePlatformAccess("platform:settings:manage");

  const parsed = providerIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    // Use the decrypted key for the real /models request.
    const provider = await getProviderWithKey(parsed.data.providerId);
    if (!provider) return { ok: false, error: "Provider not found." };

    const result = await discoverModels(provider);
    if (result.models.length === 0) {
      return { ok: false, error: "No models discovered. Check the API key and base URL." };
    }

    // Preserve the admin's current enable/disable choices across the re-sync so
    // a refresh never silently re-enables models the admin deliberately disabled.
    const existing = await db.aiModel.getByProvider(provider.id);
    const existingEnabled = new Map<string, boolean>();
    for (const model of existing) {
      existingEnabled.set(model.model_id, model.enabled);
    }

    await deleteModelsByProvider(provider.id);

    const rows = toModelEntities(result, provider.provider_key);
    for (const row of rows) {
      const enabled = existingEnabled.get(row.model_id as string);
      await db.aiModel.create({
        ...(row as Parameters<typeof db.aiModel.create>[0]),
        enabled: enabled === undefined ? (row.enabled ?? true) : enabled,
      });
    }

    await updateProvider(provider.id, {
      status: "ok",
      last_tested_at: new Date().toISOString(),
      last_error: null,
    });

    revalidatePath("/admin/settings");
    return { ok: true, data: { added: rows.length } };
  } catch (error) {
    console.error("Failed to sync provider models:", error);
    return { ok: false, error: "Failed to sync provider models." };
  }
}

// ---------------------------------------------------------------------------
// Model mutations
// ---------------------------------------------------------------------------

export async function toggleModelEnabled(input: { modelId: string; enabled: boolean }): Promise<ActionResult<null>> {
  await requirePlatformAccess("platform:settings:manage");

  const parsed = toggleModelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const model = await getModelById(parsed.data.modelId);
    if (!model) return { ok: false, error: "Model not found." };

    await updateModel(model.id, { enabled: parsed.data.enabled });
    revalidatePath("/admin/settings");
    return { ok: true, data: null };
  } catch (error) {
    console.error("Failed to toggle model:", error);
    return { ok: false, error: "Failed to update model." };
  }
}

export async function setModelCapabilities(input: {
  modelId: string;
  capabilities: string[];
}): Promise<ActionResult<null>> {
  await requirePlatformAccess("platform:settings:manage");

  const parsed = updateModelCapabilitiesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const model = await getModelById(parsed.data.modelId);
    if (!model) return { ok: false, error: "Model not found." };

    await updateModel(model.id, { capabilities: parsed.data.capabilities });
    revalidatePath("/admin/settings");
    return { ok: true, data: null };
  } catch (error) {
    console.error("Failed to update model capabilities:", error);
    return { ok: false, error: "Failed to update model capabilities." };
  }
}

export async function removeModel(input: { modelId: string }): Promise<ActionResult<null>> {
  await requirePlatformAccess("platform:settings:manage");

  const parsed = modelIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await deleteModel(parsed.data.modelId);
    revalidatePath("/admin/settings");
    return { ok: true, data: null };
  } catch (error) {
    console.error("Failed to remove model:", error);
    return { ok: false, error: "Failed to remove model." };
  }
}

// ---------------------------------------------------------------------------
// AI Defaults
// ---------------------------------------------------------------------------

export async function saveAIDefaults(input: SaveAIDefaultsInput): Promise<ActionResult<null>> {
  await requirePlatformAccess("platform:settings:manage");

  const parsed = saveAIDefaultsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const data = parsed.data;
  try {
    await updateAIDefaults({
      chat_model: data.chatModel?.trim() || null,
      fast_model: data.fastModel?.trim() || null,
      vision_model: data.visionModel?.trim() || null,
      embedding_model: data.embeddingModel?.trim() || null,
      image_model: data.imageModel?.trim() || null,
      video_model: data.videoModel?.trim() || null,
      fallback_provider: data.fallbackProvider || null,
      fallback_model: data.fallbackModel?.trim() || null,
      platform_system_prompt: data.platformSystemPrompt?.trim() || null,
      platform_safety_rules: data.platformSafetyRules?.trim() || null,
      default_system_prompt: data.defaultSystemPrompt?.trim() || null,
    });
    revalidatePath("/admin/settings");
    return { ok: true, data: null };
  } catch (error) {
    console.error("Failed to save AI defaults:", error);
    return { ok: false, error: "Failed to save AI defaults." };
  }
}
