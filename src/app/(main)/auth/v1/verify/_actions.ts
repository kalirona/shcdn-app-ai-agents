"use server";

import { isSupabase } from "@/lib/auth/provider";
import { verifySupabaseOtp } from "@/lib/supabase/auth";

export interface VerifyEmailTokenResult {
  ok: boolean;
  /** Flow type echoed back so the caller can pick the post-verify destination. */
  type?: string;
}

const KNOWN_TYPES = new Set(["recovery", "signup", "invite", "email_change", "email"]);

/**
 * Server-side verification of an emailed link token (OTP-style flows where the
 * link carries `token_hash`/`token` as a QUERY parameter).
 *
 * Implicit-flow links (tokens in the URL fragment) never reach the server; those
 * are handled client-side by supabase-verify-client via
 * supabase.auth.setSession() on the existing @supabase/ssr browser client.
 */
export async function verifyEmailTokenAction(
  token: string,
  type: string,
): Promise<VerifyEmailTokenResult> {
  if (!isSupabase()) {
    return { ok: false };
  }

  if (!token || !type || !KNOWN_TYPES.has(type)) {
    return { ok: false };
  }

  try {
    await verifySupabaseOtp(token, type);
  } catch {
    // Invalid/expired/used token. Deliberately generic: no enumeration, and the
    // error object is not surfaced (it may echo request metadata).
    return { ok: false };
  }

  return { ok: true, type };
}
