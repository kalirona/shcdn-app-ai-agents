import { redirect } from "next/navigation";

import { getCurrentSupabaseUser } from "@/lib/supabase/auth";

import { SupabaseResetPasswordForm } from "./_components/supabase-reset-password-form";

export const dynamic = "force-dynamic";

/**
 * Password-reset entry point reached from the recovery link flow
 * (/auth/v1/verify?type=recovery -> this page). The user may only reset the
 * password after a valid Supabase recovery session: the verify route establishes
 * that session (SSR cookies) before redirecting here. Without a session the user
 * is sent back to sign-in — a recovery link is a one-time token, so this also
 * covers expired/invalid links that could not establish a session.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentSupabaseUser();

  if (!user) {
    redirect("/auth/v1/login?error=invalid_link");
  }

  return <SupabaseResetPasswordForm />;
}
