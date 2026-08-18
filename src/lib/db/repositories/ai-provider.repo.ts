import { decryptApiKey, encryptApiKey } from "@/lib/ai/crypto";

import { db } from "../client";
import type { AICapability, AIProviderEntity, AIProviderKey, AIProviderType } from "../entities";

/**
 * Safe provider shape returned to the UI — never contains the raw api_key.
 */
export interface AIProviderSafe {
  id: string;
  provider_key: AIProviderKey;
  name: string;
  type: AIProviderType;
  hasApiKey: boolean;
  apiKeyHint: string;
  baseUrl: string | null;
  enabled: boolean;
  priority: number;
  defaultModel: string | null;
  capabilities: AICapability[];
  status: "untested" | "ok" | "error";
  lastTestedAt: string | null;
  lastError: string | null;
  discoverable: boolean;
  dateUpdated: string;
}

export function maskApiKey(key: string | null): { hasKey: boolean; hint: string } {
  if (!key) return { hasKey: false, hint: "" };
  const trimmed = key.trim();
  if (!trimmed) return { hasKey: false, hint: "" };
  const last = trimmed.length >= 4 ? trimmed.slice(-4) : trimmed;
  return { hasKey: true, hint: `••••••${last}` };
}

/**
 * Return the usable API key. Encrypted keys (AES-256-GCM payloads produced by
 * encryptApiKey) are decrypted; anything else (legacy plaintext keys, or a
 * decrypt failure) is returned as-is so a misconfigured or legacy value never
 * breaks the whole gateway.
 */
function safeDecrypt(key: string): string {
  try {
    return decryptApiKey(key);
  } catch {
    return key;
  }
}

export function toSafeProvider(p: AIProviderEntity): AIProviderSafe {
  const { hasKey, hint } = maskApiKey(p.api_key);
  return {
    id: p.id,
    provider_key: p.provider_key,
    name: p.name,
    type: p.type,
    hasApiKey: hasKey,
    apiKeyHint: hint,
    baseUrl: p.base_url,
    enabled: p.enabled,
    priority: p.priority,
    defaultModel: p.default_model,
    capabilities: Array.isArray(p.capabilities) ? p.capabilities : ["chat"],
    status: p.status,
    lastTestedAt: p.last_tested_at,
    lastError: p.last_error,
    discoverable: p.discoverable,
    dateUpdated: p.date_updated,
  };
}

export async function getAllProviders(): Promise<AIProviderEntity[]> {
  try {
    return await db.aiProvider.getMany({ sort: ["priority"] });
  } catch {
    return [];
  }
}

export async function getAllProvidersSafe(): Promise<AIProviderSafe[]> {
  const providers = await getAllProviders();
  return providers.map(toSafeProvider);
}

export async function getProviderById(id: string): Promise<AIProviderEntity | null> {
  try {
    return await db.aiProvider.getById(id);
  } catch {
    return null;
  }
}

export async function getProviderByKey(key: AIProviderKey): Promise<AIProviderEntity | null> {
  try {
    const providers = await db.aiProvider.getByKey(key);
    return providers[0] ?? null;
  } catch {
    return null;
  }
}

export async function createProvider(data: {
  provider_key: AIProviderKey;
  name: string;
  type: AIProviderType;
  api_key?: string | null;
  base_url?: string | null;
  enabled?: boolean;
  priority?: number;
  default_model?: string | null;
  capabilities?: AICapability[];
  discoverable?: boolean;
  input_cost_per_million?: number | null;
  output_cost_per_million?: number | null;
}): Promise<AIProviderEntity> {
  const encryptedKey = data.api_key?.trim() ? encryptApiKey(data.api_key.trim()) : null;
  return db.aiProvider.create({
    provider_key: data.provider_key,
    name: data.name,
    type: data.type,
    api_key: encryptedKey,
    base_url: data.base_url?.trim() || null,
    enabled: data.enabled ?? false,
    priority: data.priority ?? 100,
    default_model: data.default_model?.trim() || null,
    capabilities: data.capabilities ?? ["chat"],
    discoverable: data.discoverable ?? true,
    input_cost_per_million: data.input_cost_per_million ?? null,
    output_cost_per_million: data.output_cost_per_million ?? null,
  });
}

export async function updateProvider(id: string, data: Partial<AIProviderEntity>): Promise<AIProviderEntity | null> {
  try {
    const patch: Partial<AIProviderEntity> = { ...data };
    if (patch.api_key !== undefined && patch.api_key) {
      patch.api_key = encryptApiKey(patch.api_key.trim());
    }
    return await db.aiProvider.update(id, patch);
  } catch {
    return null;
  }
}

export async function deleteProvider(id: string): Promise<boolean> {
  try {
    await db.aiProvider.delete(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Enabled providers sorted by priority (lower number = higher priority).
 */
export async function getEnabledProviders(): Promise<AIProviderEntity[]> {
  const providers = await getAllProviders();
  return providers.filter((p) => p.enabled).sort((a, b) => a.priority - b.priority);
}

/**
 * Get provider with decrypted API key for internal gateway use.
 * Never expose this to the UI — use getProviderById for that.
 */
export async function getProviderWithKey(id: string): Promise<AIProviderEntity | null> {
  try {
    const provider = await db.aiProvider.getById(id);
    if (!provider?.api_key) return provider;
    return {
      ...provider,
      api_key: safeDecrypt(provider.api_key),
    };
  } catch {
    return null;
  }
}

/**
 * Get enabled providers with decrypted API keys for gateway resolution.
 * Internal use only.
 */
export async function getEnabledProvidersWithKeys(): Promise<AIProviderEntity[]> {
  const providers = await getAllProviders();
  return providers
    .filter((p) => p.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map((p) => (p.api_key ? { ...p, api_key: safeDecrypt(p.api_key) } : p));
}
