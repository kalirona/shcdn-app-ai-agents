import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireSupabaseAnonKey, requireSupabaseUrl } from "./config";

/**
 * Server Supabase client bound to the request's cookies (RLS-scoped to the
 * authenticated user).
 *
 * Intended for Server Components, Server Actions, and Route Handlers. Cookie
 * writes are wrapped so that a Server Component render can never crash on the
 * readonly-cookie restriction: @supabase/ssr only attempts a write when it needs
 * to persist a refreshed/rotated session, which during render must be delegated
 * to the /api/auth/session route handler (allowed to write cookies). All cookie
 * reads are safe in every context.
 *
 * IMPORTANT: this module imports `next/headers` cookies, so it must never be
 * imported from the Edge runtime (proxy.ts only checks cookie presence).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(requireSupabaseUrl(), requireSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component. This can be ignored if you have
          // middleware (the proxy) refreshing user sessions. Safe because reads
          // never write, and near-expiry writes go through /api/auth/session.
        }
      },
    },
  });
}
