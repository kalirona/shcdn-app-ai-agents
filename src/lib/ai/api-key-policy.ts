import type { AIProviderType } from "../db/entities";

/**
 * Pure API-key policy helpers shared by the provider repository and its
 * verification script. Deliberately free of server-only imports so the rules
 * can be unit-tested in isolation.
 *
 * Rules:
 * - Blank/whitespace secrets are NEVER stored. On update they mean
 *   "keep the existing key"; on create (for types that require a key) they are
 *   rejected.
 * - Only keyless provider types may be created without a secret.
 */

export const KEYLESS_PROVIDER_TYPES: ReadonlySet<AIProviderType> = new Set<AIProviderType>([
  "ollama",
]);

export function isBlankSecret(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

/**
 * Update semantics for api_key patches:
 *   - undefined            -> field untouched (no api_key in patch)
 *   - blank/whitespace     -> "keep existing" (api_key removed from patch)
 *   - non-blank            -> encrypted replacement
 */
export function resolveApiKeyPatch(
  incoming: string | null | undefined,
  encrypt: (plaintext: string) => string,
): { apiKey?: string } {
  if (incoming === undefined) return {};
  if (isBlankSecret(incoming)) return {};
  return { apiKey: encrypt(incoming.trim()) };
}

/**
 * Create semantics: reject providers that require a secret when none is given.
 * Never stores empty-string secrets.
 */
export function assertCreatableSecret(
  type: AIProviderType,
  apiKey: string | null | undefined,
): { apiKey: string | null } {
  const trimmed = apiKey?.trim() ?? "";
  if (trimmed.length === 0) {
    if (!KEYLESS_PROVIDER_TYPES.has(type)) {
      throw new Error("An API key is required for this provider type.");
    }
    return { apiKey: null };
  }
  return { apiKey: trimmed };
}
