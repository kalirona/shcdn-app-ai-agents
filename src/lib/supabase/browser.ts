import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseAnonKey, requireSupabaseUrl } from "./config";

/**
 * Browser Supabase client for client components.
 *
 * This client is the ONLY place anon-key-backed Supabase calls may run in the
 * browser. It uses @supabase/ssr's cookie storage so the session is shared with
 * the server-rendered session cookie (same `sb-<ref>-auth-token`).
 *
 * IMPORTANT: never import the service-role admin client here, and never place
 * SUPABASE_SERVICE_ROLE_KEY in NEXT_PUBLIC_* environment variables.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(requireSupabaseUrl(), requireSupabaseAnonKey());
}
