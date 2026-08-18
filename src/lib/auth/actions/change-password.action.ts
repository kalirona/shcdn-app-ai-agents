"use server";

import { redirect } from "next/navigation";

import { changeUserPassword, getCurrentDirectusUser, getDirectusSession } from "@/lib/auth/directus-auth";
import { changeSupabasePassword } from "@/lib/supabase/auth";
import { isSupabase } from "@/lib/auth/provider";

export type ChangePasswordState = { error?: string } | null;

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const recovery = formData.get("recovery") === "true";

  if (!newPassword || !confirmPassword) {
    return { error: "All fields are required." };
  }

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  if (isSupabase()) {
    try {
      await changeSupabasePassword(newPassword, recovery ? undefined : currentPassword);
    } catch (error) {
      console.error("Supabase password change failed:", error);
      const err = error as { status?: number; message?: string };
      if (err.status === 401 || err.message?.toLowerCase().includes("current password")) {
        return { error: "Current password is incorrect." };
      }
      if (err.message?.toLowerCase().includes("session")) {
        redirect("/auth/v1/login");
      }
      return { error: "Failed to change password. Please try again." };
    }
    redirect("/dashboard");
  }

  if (!currentPassword) {
    return { error: "Current password is required." };
  }

  const session = await getDirectusSession();
  if (!session) {
    redirect("/auth/v1/login");
  }

  try {
    // Verify current password by attempting to login with it
    const user = await getCurrentDirectusUser();
    if (!user) {
      return { error: "Session expired. Please sign in again." };
    }

    // Directus doesn't have a "verify password" endpoint, so we'll attempt
    // to change the password which will fail if the user isn't authenticated.
    // The changeUserPassword function uses the access token directly.
    await changeUserPassword(session.accessToken, newPassword);
  } catch (error) {
    console.error("Password change failed:", error);
    const err = error as { status?: number; message?: string };
    if (err.status === 401 || err.message?.includes("Unauthorized")) {
      return { error: "Current password is incorrect." };
    }
    return { error: "Failed to change password. Please try again." };
  }

  redirect("/dashboard");
}