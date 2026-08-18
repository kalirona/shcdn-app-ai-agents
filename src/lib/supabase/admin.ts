import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseServiceRoleKey, requireSupabaseUrl } from "./config";

/**
 * Server-only Supabase admin client authenticated with the service-role key.
 *
 * Bypasses RLS — use ONLY for server-side operations where the authenticated
 * user's RLS policies intentionally forbid the operation but the server is the
 * trusted broker (e.g. auto-provisioning a profile/workspace on first login,
 * reading platform_roles for super-admin checks).
 *
 * SECURITY: importing this module in client code is a build error via
 * "server-only". Never place the service-role key in NEXT_PUBLIC_* env vars and
 * never pass this client to the browser.
 */
let client: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (!client) {
    client = createClient(requireSupabaseUrl(), requireSupabaseServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return client;
}
