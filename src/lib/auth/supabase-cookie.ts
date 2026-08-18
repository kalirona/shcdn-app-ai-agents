import { SUPABASE_SESSION_COOKIE_PREFIX } from "./provider";

/**
 * Edge-safe helpers for reading the @supabase/ssr session cookie.
 *
 * The edge runtime (proxy.ts) cannot use node:crypto, but it needs to detect a
 * near-expiry Supabase session so it can redirect to /api/auth/session for a
 * refresh (the only context allowed to write cookies). The sb-* cookie value is
 * `base64-<base64url(JSON session)>` by default (@supabase/ssr cookieEncoding
 * "base64url"), possibly split into chunks named `<key>.0`, `<key>.1`, ... when
 * it exceeds 3180 chars. The session JSON carries `expires_at` (epoch SECONDS).
 *
 * IMPORTANT: this module must stay dependency-light — it runs in the Edge
 * runtime, where only NEXT_PUBLIC_* env vars are inlined. It therefore detects
 * the session cookie by name pattern, not by reading the Supabase URL env.
 */

function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeBase64Url(input: string): string {
  return new TextDecoder().decode(base64UrlToBytes(input));
}

interface SupabaseCookieLike {
  name: string;
  value: string;
}

/**
 * Finds the base session cookie name: the first cookie named
 * `sb-<ref>-auth-token` (its chunked siblings are `<name>.N`). Returns null when
 * no Supabase session cookie is present.
 */
function findSessionKey(cookies: SupabaseCookieLike[]): string | null {
  for (const cookie of cookies) {
    if (
      cookie.name.startsWith(SUPABASE_SESSION_COOKIE_PREFIX) &&
      cookie.name.endsWith("-auth-token") &&
      !/\.\d+$/.test(cookie.name)
    ) {
      return cookie.name;
    }
  }
  return null;
}

function getSessionCookieChunks(cookies: SupabaseCookieLike[]): SupabaseCookieLike[] {
  const key = findSessionKey(cookies);
  if (!key) {
    return [];
  }
  const chunks: SupabaseCookieLike[] = [];
  const base = cookies.find((c) => c.name === key);
  if (base) {
    chunks.push(base);
  }
  for (let i = 0; i < 20; i += 1) {
    const chunk = cookies.find((c) => c.name === `${key}.${i}`);
    if (!chunk) {
      break;
    }
    chunks.push(chunk);
  }
  return chunks;
}

/**
 * Presence check: any cookie whose name starts with the sb- prefix. This is the
 * @supabase/ssr naming scheme (sb-<ref>-auth-token and code-verifier), so it
 * works without knowing the exact project reference.
 */
export function hasSupabaseSessionCookie(cookies: SupabaseCookieLike[]): boolean {
  return cookies.some((c) => c.name.startsWith(SUPABASE_SESSION_COOKIE_PREFIX) && c.value.length > 0);
}

/**
 * Parses the session JSON out of the sb-* cookie. Returns the session object
 * (with expires_at in epoch seconds) or null when the cookie is absent/garbage.
 */
export function readSupabaseSession(cookies: SupabaseCookieLike[]): { expires_at: number } | null {
  const chunks = getSessionCookieChunks(cookies);
  if (chunks.length === 0) {
    return null;
  }

  let raw = chunks.map((c) => c.value).join("");
  if (raw.startsWith("base64-")) {
    raw = raw.slice("base64-".length);
  }

  try {
    const json = decodeBase64Url(raw);
    const parsed = JSON.parse(json) as { expires_at?: number };
    if (typeof parsed.expires_at !== "number") {
      return null;
    }
    return { expires_at: parsed.expires_at };
  } catch {
    return null;
  }
}

/**
 * A Supabase session is near-expiry when its access token expires within the
 * skew window. Missing/garbage cookie data is treated as "revalidate" (true) so
 * the proxy routes it to /api/auth/session, which clears dead sessions and
 * breaks redirect loops.
 */
export function isSupabaseSessionNearExpiry(cookies: SupabaseCookieLike[], skewMs: number): boolean {
  const session = readSupabaseSession(cookies);
  if (!session) {
    return true;
  }
  const expiresAtMs = session.expires_at * 1000;
  return !Number.isFinite(expiresAtMs) || Date.now() >= expiresAtMs - skewMs;
}