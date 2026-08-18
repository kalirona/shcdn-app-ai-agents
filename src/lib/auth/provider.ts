export type AuthProvider = "directus" | "supabase";

/**
 * Directus session cookie name.
 * Referenced by both the edge middleware (presence check only) and the Node
 * runtime session layer (encrypted read/write).
 */
export const DIRECTUS_SESSION_COOKIE = "directus_session";

/**
 * Companion cookie holding the encrypted session's access-token expiry (epoch
 * ms). It is written whenever the session cookie is written, and lets the edge
 * proxy detect a near-expiry session without decrypting (node:crypto is not
 * available in the Edge runtime). The proxy then redirects to the /api/auth/session
 * route handler, which is allowed to write cookies and performs the rotation.
 */
export const DIRECTUS_SESSION_EXP_COOKIE = "directus_session_exp";

/**
 * Access-token refresh lead time (ms). A session is considered near-expiry and
 * routed to the /api/auth/session route handler for rotation once the access
 * token is within this window of its expiry. Kept here (not in directus-auth.ts)
 * so the Edge proxy can read it without pulling in node:crypto.
 */
export const DIRECTUS_ACCESS_TOKEN_SKEW_MS = 30_000;

/**
 * Prefix for Supabase auth session cookies (sb-<project-ref>-auth-token and
 * sb-<project-ref>-auth-token-code-verifier). Used by the edge proxy for a
 * presence-only check, matching @supabase/ssr's cookie naming scheme.
 */
export const SUPABASE_SESSION_COOKIE_PREFIX = "sb-";

/**
 * Access-token refresh lead time (ms) for Supabase sessions, mirrored from the
 * Directus skew. The edge proxy redirects to /api/auth/session once the session
 * JSON's expires_at (epoch seconds, read without node:crypto) is inside this
 * window, so the rotation happens in a context allowed to write cookies.
 */
export const SUPABASE_ACCESS_TOKEN_SKEW_MS = 30_000;

/**
 * The application's active authentication provider, selected via AUTH_PROVIDER.
 *
 * Supported values:
 *   "directus" — legacy provider, kept intact for rollback compatibility.
 *   "supabase" — new identity provider (GoTrue + public schema RLS).
 *
 * Any unset or unknown value is a hard configuration error — there is
 * deliberately no fallback (previously an unset AUTH_PROVIDER silently selected
 * Logto and produced a broken login page). The process fails fast instead of
 * serving a misconfigured UI.
 */
export function getAuthProvider(): AuthProvider {
  const provider = process.env.AUTH_PROVIDER;
  if (provider === "directus") {
    return "directus";
  }
  if (provider === "supabase") {
    return "supabase";
  }
  throw new Error(
    `AUTH_PROVIDER must be set to "directus" or "supabase" in production. Received: ${
      provider ? `"${provider}"` : "(unset)"
    }. This is a deployment misconfiguration and is fatal by design.`,
  );
}

export function isDirectus(): boolean {
  return getAuthProvider() === "directus";
}

export function isSupabase(): boolean {
  return getAuthProvider() === "supabase";
}