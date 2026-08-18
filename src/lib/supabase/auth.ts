import "server-only";

import { cache } from "react";

import { createSupabaseServerClient } from "./server";

import type { User } from "@/lib/auth/types";

/**
 * Supabase authentication helper (server-only).
 *
 * Every GoTrue auth call and the sb-* session cookie handling live here. The
 * session cookie is written and managed by @supabase/ssr's createServerClient,
 * which transparently refreshes the access token and persists the rotated
 * session cookie.
 *
 * IMPORTANT: never import this module from the Edge runtime (proxy.ts) or from
 * client components. It uses next/headers cookies and the server-only guard
 * makes client-side imports a build error. The proxy only checks for the
 * presence of the sb-* cookie.
 */

export interface SupabaseAppUser extends User {
  /** Whether the GoTrue account still needs email confirmation. */
  emailConfirmed: boolean;
}

/**
 * Builds the application User shape from a GoTrue user plus the matching
 * profile row (fetched by the caller). Falls back to user_metadata for
 * name/avatar when the profile is missing.
 */
export function toSupabaseAppUser(input: {
  id: string;
  email: string;
  userMetadata?: { name?: string | null; avatar?: string | null; [key: string]: unknown };
  profile?: {
    first_name?: string | null;
    last_name?: string | null;
    force_password_reset?: boolean | null;
  } | null;
}): SupabaseAppUser {
  const profileName = [input.profile?.first_name, input.profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    id: input.id,
    email: input.email,
    name: profileName || input.userMetadata?.name || null,
    avatar: input.userMetadata?.avatar ?? null,
    forcePasswordReset: input.profile?.force_password_reset ?? false,
    emailConfirmed: true,
  };
}

/**
 * Resolves the current Supabase session from the sb-* cookie. PURE READ: never
 * writes, deletes, or refreshes the cookie here — cookie mutation is only allowed
 * in a Server Action or Route Handler in Next.js. Near-expiry sessions are
 * refreshed by the /api/auth/session Route Handler (the edge proxy redirects to
 * it via the expires_at inside the session cookie); invalid cookies are cleared
 * there too.
 *
 * Returns null when there is no usable session.
 */
export const getCurrentSupabaseUser = cache(async function getCurrentSupabaseUser(): Promise<SupabaseAppUser | null> {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    // Unreadable sb-* cookie (e.g. malformed base64) — treat as signed out so
    // layouts can loop-break via /api/auth/session instead of crashing.
    return null;
  }

  const { data, error } = await supabase.auth.getUser().catch(() => ({ data: { user: null }, error: null }));

  if (error || !data.user) {
    return null;
  }

  const user = data.user;

  let profile: { first_name: string | null; last_name: string | null; force_password_reset: boolean } | null = null;
  try {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("first_name,last_name,force_password_reset")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profileError && profileData) {
      profile = profileData;
    }
  } catch {
    // Profile resolution is best-effort; identity still comes from GoTrue.
  }

  return toSupabaseAppUser({
    id: user.id,
    email: user.email ?? "",
    userMetadata: user.user_metadata,
    profile,
  });
});

/**
 * Session revalidation used by the /api/auth/session Route Handler (the proxy
 * redirects near-expiry sessions here, and layouts redirect when a cookie is
 * present but the user cannot be resolved). Cookie mutation is allowed in these
 * contexts, unlike during Server Component render. getUser() validates against
 * GoTrue and transparently refreshes a near-expiry access token, persisting the
 * rotated session cookie; a dead session clears the cookie and ends any redirect
 * loop.
 */
export async function revalidateSupabaseSession(): Promise<"ok" | "cleared"> {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    // Unreadable/unsupported sb-* cookie (e.g. malformed base64). No session to
    // revalidate — treat as cleared so the redirect loop ends at sign-in.
    return "cleared";
  }

  const { data, error } = await supabase.auth.getUser().catch(() => ({ data: { user: null }, error: null }));

  if (error || !data.user) {
    try {
      await supabase.auth.signOut();
    } catch {
      // signOut can itself throw on a malformed cookie; clearing the loop is
      // what matters, and the redirect to sign-in below is still correct.
    }
    return "cleared";
  }
  return "ok";
}

/**
 * Signs into Supabase (password grant). Establishes the sb-* session cookie via
 * @supabase/ssr and returns the authenticated application user. Throws on
 * invalid credentials or unconfirmed email.
 */
export async function loginWithSupabase(email: string, password: string): Promise<SupabaseAppUser> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const err = new Error(error?.message ?? "Invalid email or password.") as Error & {
      status?: number;
      code?: string;
    };
    if (error?.code === "email_not_confirmed" || error?.message?.includes("confirm your email")) {
      err.status = 403;
      err.code = "email_not_confirmed";
    } else {
      err.status = 401;
      err.code = "invalid_credentials";
    }
    throw err;
  }

  const currentUser = await getCurrentSupabaseUser();
  if (currentUser) {
    return currentUser;
  }

  return toSupabaseAppUser({ id: data.user.id, email: data.user.email ?? "" });
}

export interface SupabaseCreateUserInput {
  email: string;
  password: string;
  name: string;
}

/**
 * Self-service Supabase registration.
 *
 * GoTrue is configured with MAILER_AUTOCONFIRM=false, so sign-up requires email
 * confirmation: the response contains a user but NO session. The register form
 * must therefore surface a "check your email" confirmation-pending state instead
 * of signing the user straight in (unlike the Directus flow).
 */
export async function signUpWithSupabase(input: SupabaseCreateUserInput): Promise<{
  user: SupabaseAppUser | null;
  needsEmailConfirmation: boolean;
}> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { name: input.name },
    },
  });

  if (error) {
    const err = new Error(error.message) as Error & { status?: number; code?: string };
    err.code = error.code ?? "signup_failed";
    err.status = 400;
    throw err;
  }

  const needsEmailConfirmation = !data.session && Boolean(data.user);

  const user = data.user
    ? toSupabaseAppUser({
        id: data.user.id,
        email: data.user.email ?? input.email,
        userMetadata: data.user.user_metadata,
      })
    : null;

  return { user, needsEmailConfirmation };
}

/**
 * Invalidates the Supabase session and clears the sb-* cookies.
 */
export async function signOutFromSupabase(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

/**
 * Verifies a one-time token from an email link (email confirmation, password
 * recovery, invite, email change). Used by the /auth/v1/verify route handler
 * that GoTrue emails link to. On success a session is established; the caller
 * redirects based on the flow type.
 */
export async function verifySupabaseOtp(tokenHash: string, type: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as never,
  });

  if (error) {
    throw error;
  }
}

/**
 * Sends a password-recovery email for the given address (GoTrue emails a link
 * to /auth/v1/verify?type=recovery). Does not throw for unknown addresses (no
 * account enumeration).
 */
export async function resetSupabasePassword(email: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const redirectTo = appUrl ? `${appUrl}/auth/v1/verify` : "/auth/v1/verify";

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    throw error;
  }
}

/**
 * Changes the current user's password.
 *
 * Normal mode (currentPassword present): verifies the existing password via a
 * password sign-in before updating, so the UI's "current password" field has
 * real meaning.
 *
 * Recovery mode (currentPassword absent, called after a recovery-link
 * verifyOtp): GoTrue already established a recovery session, so only the new
 * password is required.
 */
export async function changeSupabasePassword(newPassword: string, currentPassword?: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  if (currentPassword) {
    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user?.email;

    if (!email) {
      const err = new Error("Session expired. Please sign in again.") as Error & { status?: number };
      err.status = 401;
      throw err;
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) {
      const err = new Error("Current password is incorrect.") as Error & { status?: number };
      err.status = 401;
      throw err;
    }
  }

  const { data: updateData, error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    throw error;
  }

  // Clear the force-password-reset flag on the user's own profile (RLS
  // profiles_own_update permits self-service updates), mirroring the Directus
  // flow where the flag is cleared after a successful password change.
  const userId = updateData.user?.id;
  if (userId) {
    try {
      await supabase
        .from("profiles")
        .update({ force_password_reset: false })
        .eq("user_id", userId);
    } catch {
      // best-effort; the password itself is already changed
    }
  }
}
