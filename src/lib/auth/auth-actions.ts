"use server";

import { redirect } from "next/navigation";

import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { getPlatformSettings } from "@/lib/db/repositories/platform-settings.repo";

import { directusCreateUser, getCurrentDirectusUser, loginWithDirectus, signOutFromDirectus } from "./directus-auth";
import { isSupabase } from "./provider";
import {
  loginWithSupabase,
  getCurrentSupabaseUser,
  signOutFromSupabase,
  signUpWithSupabase,
} from "@/lib/supabase/auth";
import { directusLoginSchema, directusSignUpSchema, supabaseLoginSchema, supabaseSignUpSchema } from "./schemas/auth.schema";

export async function signInAction() {
  redirect("/auth/v1/login");
}

export async function signOutAction() {
  const session = isSupabase() ? await getCurrentSupabaseUser() : await getCurrentDirectusUser();

  if (isSupabase()) {
    await signOutFromSupabase();
  } else {
    await signOutFromDirectus();
  }

  if (session?.id) {
    await logAudit({
      action: AUDIT_ACTIONS.LOGOUT,
      category: "auth",
      actor: session.id,
      actorEmail: session.email,
      status: "success",
      severity: "info",
      targetType: "user",
      targetId: session.id,
      targetLabel: session.email,
    });
  }
  redirect("/");
}

export async function signUpAction() {
  // Honor the platform "allow new signups" setting. When disabled, route
  // prospective users to the existing sign-in page instead of registration.
  const settings = await getPlatformSettings();
  if (settings?.signup_enabled === false) {
    redirect("/auth/v1/login");
    return;
  }

  redirect("/auth/v1/register");
}

export type DirectusSignInState = { error?: string } | null;

export async function directusSignInAction(
  _prevState: DirectusSignInState,
  formData: FormData,
): Promise<DirectusSignInState> {
  const parsed = directusLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sign-in details." };
  }

  try {
    const user = await loginWithDirectus(parsed.data.email, parsed.data.password);
    await logAudit({
      action: AUDIT_ACTIONS.LOGIN,
      category: "auth",
      actor: user.id,
      actorEmail: user.email,
      status: "success",
      severity: "info",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) {
      await logAudit({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        category: "auth",
        actorEmail: parsed.data.email,
        status: "failure",
        severity: "warning",
        targetType: "user",
        targetLabel: parsed.data.email,
        metadata: { reason: "invalid_credentials" },
      });
      return { error: "Invalid email or password." };
    }
    console.error("Directus sign-in failed:", error);
    await logAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      category: "auth",
      actorEmail: parsed.data.email,
      status: "failure",
      severity: "warning",
      targetType: "user",
      targetLabel: parsed.data.email,
      metadata: { reason: "server_error", status },
    });
    return { error: "Unable to sign in. Please try again later." };
  }

  redirect("/dashboard");
}

export type SupabaseSignInState = { error?: string } | null;

export async function supabaseSignInAction(
  _prevState: SupabaseSignInState,
  formData: FormData,
): Promise<SupabaseSignInState> {
  const parsed = supabaseLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sign-in details." };
  }

  try {
    const user = await loginWithSupabase(parsed.data.email, parsed.data.password);
    await logAudit({
      action: AUDIT_ACTIONS.LOGIN,
      category: "auth",
      actor: user.id,
      actorEmail: user.email,
      status: "success",
      severity: "info",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    const code = (error as { code?: string }).code;
    if (status === 401) {
      await logAudit({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        category: "auth",
        actorEmail: parsed.data.email,
        status: "failure",
        severity: "warning",
        targetType: "user",
        targetLabel: parsed.data.email,
        metadata: { reason: "invalid_credentials" },
      });
      return { error: "Invalid email or password." };
    }
    if (status === 403 || code === "email_not_confirmed") {
      await logAudit({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        category: "auth",
        actorEmail: parsed.data.email,
        status: "failure",
        severity: "warning",
        targetType: "user",
        targetLabel: parsed.data.email,
        metadata: { reason: "email_not_confirmed" },
      });
      return { error: "Please confirm your email address before signing in. Check your inbox for the confirmation link." };
    }
    console.error("Supabase sign-in failed:", error);
    await logAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      category: "auth",
      actorEmail: parsed.data.email,
      status: "failure",
      severity: "warning",
      targetType: "user",
      targetLabel: parsed.data.email,
      metadata: { reason: "server_error", status, code },
    });
    return { error: "Unable to sign in. Please try again later." };
  }

  redirect("/dashboard");
}

export type SupabaseSignUpState = { error?: string; pendingConfirmation?: boolean } | null;

/**
 * Self-service Supabase registration. GoTrue is configured with email
 * confirmation required, so a successful signup returns a confirmation-pending
 * state ("check your email") rather than auto-signing the user in.
 */
export async function supabaseSignUpAction(
  _prevState: SupabaseSignUpState,
  formData: FormData,
): Promise<SupabaseSignUpState> {
  const settings = await getPlatformSettings();
  if (settings?.signup_enabled === false) {
    return { error: "Self-service registration is currently disabled. Ask your administrator for an invite." };
  }

  const parsed = supabaseSignUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid registration details." };
  }

  try {
    const { user, needsEmailConfirmation } = await signUpWithSupabase(parsed.data);
    if (user) {
      await logAudit({
        action: AUDIT_ACTIONS.SIGNUP,
        category: "auth",
        actor: user.id,
        actorEmail: user.email,
        status: "success",
        severity: "info",
        targetType: "user",
        targetId: user.id,
        targetLabel: user.email,
      });
    }
    if (needsEmailConfirmation) {
      return { pendingConfirmation: true };
    }
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string };
    if (code === "user_already_exists" || message?.toLowerCase().includes("already registered")) {
      await logAudit({
        action: AUDIT_ACTIONS.SIGNUP_FAILED,
        category: "auth",
        actorEmail: parsed.data.email,
        status: "failure",
        severity: "warning",
        targetType: "user",
        targetLabel: parsed.data.email,
        metadata: { reason: "email_taken" },
      });
      return { error: "An account with this email already exists. Try signing in instead." };
    }
    console.error("Supabase sign-up failed:", error);
    await logAudit({
      action: AUDIT_ACTIONS.SIGNUP_FAILED,
      category: "auth",
      actorEmail: parsed.data.email,
      status: "failure",
      severity: "warning",
      targetType: "user",
      targetLabel: parsed.data.email,
      metadata: { reason: "server_error", code },
    });
    return { error: "Unable to create your account. Please try again later." };
  }

  redirect("/dashboard");
}

/**
 * Self-service Directus registration. Creates the account in Directus, then
 * signs the user in so they land directly on the dashboard.
 */
export type DirectusSignUpState = { error?: string } | null;

export async function directusSignUpAction(
  _prevState: DirectusSignUpState,
  formData: FormData,
): Promise<DirectusSignUpState> {
  const settings = await getPlatformSettings();
  if (settings?.signup_enabled === false) {
    return { error: "Self-service registration is currently disabled. Ask your administrator for an invite." };
  }

  const parsed = directusSignUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid registration details." };
  }

  try {
    await directusCreateUser(parsed.data);
    const user = await loginWithDirectus(parsed.data.email, parsed.data.password);
    await logAudit({
      action: AUDIT_ACTIONS.SIGNUP,
      category: "auth",
      actor: user.id,
      actorEmail: user.email,
      status: "success",
      severity: "info",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
    });
  } catch (error) {
    const { status, code } = error as { status?: number; code?: string };
    if (code === "RECORD_NOT_UNIQUE" || (status === 400 && !code)) {
      await logAudit({
        action: AUDIT_ACTIONS.SIGNUP_FAILED,
        category: "auth",
        actorEmail: parsed.data.email,
        status: "failure",
        severity: "warning",
        targetType: "user",
        targetLabel: parsed.data.email,
        metadata: { reason: "email_taken" },
      });
      return { error: "An account with this email already exists. Try signing in instead." };
    }
    console.error("Directus sign-up failed:", error);
    await logAudit({
      action: AUDIT_ACTIONS.SIGNUP_FAILED,
      category: "auth",
      actorEmail: parsed.data.email,
      status: "failure",
      severity: "warning",
      targetType: "user",
      targetLabel: parsed.data.email,
      metadata: { reason: "server_error", status, code },
    });
    return { error: "Unable to create your account. Please try again later." };
  }

  redirect("/dashboard");
}

export type SupabaseForgotPasswordState = { error?: string; sent?: boolean } | null;

/**
 * Sends a password-recovery email. Deliberately returns the same "sent" state
 * whether or not the address exists (no account enumeration).
 */
export async function supabaseForgotPasswordAction(
  _prevState: SupabaseForgotPasswordState,
  formData: FormData,
): Promise<SupabaseForgotPasswordState> {
  const email = formData.get("email") as string;

  const parsed = supabaseLoginSchema.safeParse({ email, password: "placeholder" });
  if (!parsed.success) {
    return { error: "Please enter a valid email address." };
  }

  try {
    const { resetSupabasePassword } = await import("@/lib/supabase/auth");
    await resetSupabasePassword(parsed.data.email);
  } catch (error) {
    console.error("Password reset email failed:", error);
    return { error: "Unable to send the reset email. Please try again later." };
  }

  return { sent: true };
}
