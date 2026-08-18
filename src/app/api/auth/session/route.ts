import { type NextRequest, NextResponse } from "next/server";

import { revalidateDirectusSession } from "@/lib/auth/directus-auth";
import { isSupabase } from "@/lib/auth/provider";
import { revalidateSupabaseSession } from "@/lib/supabase/auth";

/**
 * Session revalidation endpoint.
 *
 * Next.js 16 forbids writing cookies during Server Component render, so the
 * access-token refresh (which must persist the rotated session cookie — the
 * encrypted Directus cookie or @supabase/ssr's sb-* cookie) can only happen in a
 * Server Action or a Route Handler. The edge proxy redirects near-expiry
 * requests here via the provider's expiry marker (the plaintext
 * DIRECTUS_SESSION_EXP companion cookie, or expires_at parsed from the sb-*
 * session cookie); layouts also redirect here when a session cookie exists but
 * the user could not be resolved. On success the caller is redirected back to
 * `next` with a fresh session; otherwise cookies are cleared and the user is
 * sent to sign-in.
 */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? request.nextUrl.origin;
  const destination = new URL(safeNext, origin);

  const result = isSupabase() ? await revalidateSupabaseSession() : await revalidateDirectusSession();

  if (result === "ok") {
    return NextResponse.redirect(destination);
  }

  return NextResponse.redirect(new URL("/auth/v1/login", origin));
}
