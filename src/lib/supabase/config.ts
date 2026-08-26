const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

// Read lazily (inside the function): this module is also imported by the
// BROWSER client (browser.ts), and a module-scope reference would embed a
// process.env.SUPABASE_SERVICE_ROLE_KEY lookup into client bundles.
function supabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";
}

export function requireSupabaseUrl(): string {
  if (!SUPABASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) must be set when AUTH_PROVIDER=supabase.",
    );
  }
  return SUPABASE_URL.replace(/\/$/, "");
}

export function requireSupabaseAnonKey(): string {
  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY/SUPABASE_PUBLISHABLE_KEY) must be set when AUTH_PROVIDER=supabase.",
    );
  }
  return SUPABASE_ANON_KEY;
}

export function requireSupabaseServiceRoleKey(): string {
  const key = supabaseServiceRoleKey();
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) must be set when AUTH_PROVIDER=supabase. " +
        "Never expose this key in NEXT_PUBLIC_* environment variables or browser code.",
    );
  }
  return key;
}

/**
 * The application session cookie name written by @supabase/ssr.
 * @supabase/supabase-js derives it from the project reference (first DNS label
 * of the Supabase URL host): `sb-${hostname.split(".")[0]}-auth-token`.
 */
export function getSupabaseSessionCookieName(): string {
  const host = new URL(requireSupabaseUrl()).hostname.split(".")[0];
  return `sb-${host}-auth-token`;
}
