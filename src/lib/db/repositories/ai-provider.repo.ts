import { assertCreatableSecret, resolveApiKeyPatch } from "@/lib/ai/api-key-policy";
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
 * Fail-closed decryption of a stored provider secret.
 *
 * Unlike a legacy lenient variant, this NEVER returns raw stored bytes when
 * decryption fails: a missing/misconfigured AI_API_KEY_ENCRYPTION_KEY, a
 * malformed payload, or an auth-tag mismatch all throw a secret-free
 * configuration error. Ciphertext must never be treated as a plaintext key.
 */
class StoredSecretError extends Error {}

function decryptStoredSecret(key: string): string {
  try {
    return decryptApiKey(key);
  } catch {
    throw new StoredSecretError(
      "Stored provider API key cannot be decrypted. Verify AI_API_KEY_ENCRYPTION_KEY or re-save the provider's API key.",
    );
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
  // Reject keyless creates for provider types that require a secret; blank
  // secrets are never stored.
  const { apiKey } = assertCreatableSecret(data.type, data.api_key);
  const encryptedKey = apiKey ? encryptApiKey(apiKey) : null;
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
    // Blank/whitespace api_key means "keep the existing key": strip it from the
    // patch instead of overwriting (or storing an empty-string secret).
    if ("api_key" in patch) {
      delete patch.api_key;
      const { apiKey } = resolveApiKeyPatch(data.api_key, encryptApiKey);
      if (apiKey !== undefined) {
        patch.api_key = apiKey;
      }
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
 *
 * Fail-closed: DB failures resolve to null, but secret-decryption failures
 * THROW (StoredSecretError) — a misconfigured encryption key must never be
 * mistaken for "provider has no usable key".
 */
export async function getProviderWithKey(id: string): Promise<AIProviderEntity | null> {
  let provider: AIProviderEntity | null;
  try {
    provider = await db.aiProvider.getById(id);
  } catch {
    return null;
  }
  if (!provider?.api_key) return provider;
  return { ...provider, api_key: decryptStoredSecret(provider.api_key) };
}

/**
 * Get enabled providers with decrypted API keys for gateway resolution.
 * Internal use only. See getProviderWithKey for the fail-closed contract.
 */
/**
 * Get enabled providers with decrypted API keys for gateway resolution.
 * Internal use only. See getProviderWithKey for the fail-closed contract.
 *
 * Providers whose stored secret cannot be decrypted are SKIPPED (with a loud
 * server-side log) instead of throwing: a single stale key must not take down
 * AI resolution for the whole platform — the gateway falls back to remaining
 * providers or the legacy env-driven path.
 */
export async function getEnabledProvidersWithKeys(): Promise<AIProviderEntity[]> {
  const providers = await getAllProviders();
  const usable: AIProviderEntity[] = [];
  for (const p of providers.filter((p) => p.enabled).sort((a, b) => a.priority - b.priority)) {
    if (!p.api_key) {
      usable.push(p);
      continue;
    }
    try {
      usable.push({ ...p, api_key: decryptStoredSecret(p.api_key) });
    } catch {
      console.error(
        `[ai-provider.repo] Provider "${p.name}" (${p.provider_key}) has an undecryptable stored API key — skipping it. Re-save the key in Admin → Settings → AI Providers.`,
      );
    }
  }
  return usable;
}
