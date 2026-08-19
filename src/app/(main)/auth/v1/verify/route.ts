import { type NextRequest, NextResponse } from "next/server";

import { verifySupabaseOtp } from "@/lib/supabase/auth";

/**
 * Handles the links GoTrue emails to users (email confirmation, password
 * recovery, invites, email change). GoTrue's default mailer links to
 * `/auth/v1/verify?token_hash=<hash>&type=<type>` (MAILER_URLPATHS_*).
 *
 * On success a Supabase session is established (cookies are writable in a route
 * handler). The redirect destination depends on the flow type:
 *   - signup/invite/email_change  -> dashboard
 *   - recovery                     -> reset-password (recovery mode; the page
 *                                     re-verifies the established session)
 *
 * On failure the user is sent back to sign-in with a generic error (no
 * enumeration or leak).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
  const type = searchParams.get("type");
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? request.nextUrl.origin;

  if (!tokenHash || !type) {
    const login = new URL("/auth/v1/login", origin);
    login.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(login);
  }

  try {
    await verifySupabaseOtp(tokenHash, type);

    if (type === "recovery") {
      const reset = new URL("/auth/v1/reset-password", origin);
      return NextResponse.redirect(reset);
    }

    return NextResponse.redirect(new URL("/dashboard", origin));
  } catch (error) {
    console.error("Email link verification failed:", error);
    const login = new URL("/auth/v1/login", origin);
    login.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(login);
  }
}