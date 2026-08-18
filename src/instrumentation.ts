/**
 * Server startup validation (Next.js instrumentation).
 *
 * Fails fast at boot when required production environment variables are missing
 * or invalid, instead of serving a misconfigured deployment (the "white login
 * page" / silent provider fallback failure mode). The check is intentionally
 * strict: the active auth provider's required variables are mandatory.
 *
 * register() runs once when the Node.js server instance is initiated and must
 * complete before the server handles requests. It is skipped during `next build`
 * (NEXT_PHASE=phase-production-build) so builds remain reproducible; the
 * standalone server enforces it at runtime.
 */
function validateProductionEnv(): void {
  const failures: string[] = [];

  const provider = process.env.AUTH_PROVIDER;
  if (provider !== "directus" && provider !== "supabase") {
    failures.push(
      `AUTH_PROVIDER must be "directus" or "supabase" (received: ${provider ?? "(unset)"})`,
    );
    throw new Error(`Invalid production environment:\n- ${failures.join("\n- ")}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    failures.push(`NEXT_PUBLIC_APP_URL is required (the public origin, e.g. https://myapp.sitenexai.com)`);
  } else if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(appUrl)) {
    failures.push(`NEXT_PUBLIC_APP_URL must be the public production origin (received: ${appUrl})`);
  }

  if (provider === "supabase") {
    const supabaseRequired: Array<[string, string]> = [
      ["NEXT_PUBLIC_SUPABASE_URL", "the Supabase project URL, e.g. https://sup.sitenexai.com"],
      ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "the publishable (anon) key"],
      ["SUPABASE_SERVICE_ROLE_KEY", "the server-only service-role key; never expose with a NEXT_PUBLIC_ prefix"],
    ];
    for (const [key, hint] of supabaseRequired) {
      if (!process.env[key]) {
        failures.push(`${key} is required (${hint})`);
      }
    }
  } else {
    const directusRequired: Array<[string, string]> = [
      ["SESSION_SECRET", "encrypts the session cookie; run `openssl rand -base64 32` to generate one"],
      ["DIRECTUS_URL", "the Directus instance base URL"],
      ["DIRECTUS_TOKEN", "the server-side Directus static token"],
    ];
    for (const [key, hint] of directusRequired) {
      if (!process.env[key]) {
        failures.push(`${key} is required (${hint})`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Invalid production environment:\n- ${failures.join("\n- ")}`);
  }
}

export function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  validateProductionEnv();
}
