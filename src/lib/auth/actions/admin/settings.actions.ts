"use server";

import { revalidatePath } from "next/cache";

import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { requirePlatformAccess } from "@/lib/auth/platform-access";
import {
  type SaveEmailSettingsInput,
  type SavePlatformSettingsInput,
  type SaveSecuritySettingsInput,
  type SaveStorageSettingsInput,
  saveEmailSettingsSchema,
  savePlatformSettingsSchema,
  saveSecuritySettingsSchema,
  saveStorageSettingsSchema,
} from "@/lib/auth/schemas/platform-settings.schema";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/db/repositories/platform-settings.repo";

import { getPlatformStats } from "./admin.actions";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

export async function getAdminPlatformSettings() {
  await requirePlatformAccess("platform:settings:manage");
  return getPlatformSettings();
}

export async function saveGeneralSettings(input: SavePlatformSettingsInput): Promise<ActionResult<null>> {
  const access = await requirePlatformAccess("platform:settings:manage");

  const parsed = savePlatformSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const data = parsed.data;
  try {
    await updatePlatformSettings({
      platform_name: data.platformName?.trim() || null,
      support_email: data.supportEmail?.trim() || null,
      maintenance_mode: data.maintenanceMode ?? false,
      signup_enabled: data.signupEnabled ?? true,
      default_workspace_plan: data.defaultWorkspacePlan?.trim() || null,
    });
    await logAudit({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      category: "admin",
      actor: access.userId,
      status: "success",
      severity: "info",
      targetType: "platform_settings",
      targetId: "general",
      targetLabel: "General settings",
    });
    revalidatePath("/admin/settings");
    return { ok: true, data: null };
  } catch (error) {
    console.error("Failed to save platform settings:", error);
    await logAudit({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      category: "admin",
      actor: access.userId,
      status: "failure",
      severity: "warning",
      targetType: "platform_settings",
      targetId: "general",
      targetLabel: "General settings",
      metadata: { reason: "save_failed" },
    });
    return { ok: false, error: "Failed to save platform settings." };
  }
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

export async function saveSecuritySettings(input: SaveSecuritySettingsInput): Promise<ActionResult<null>> {
  const access = await requirePlatformAccess("platform:settings:manage");

  const parsed = saveSecuritySettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await updatePlatformSettings({
      session_timeout_hours: parsed.data.sessionTimeoutHours,
      require_2fa: parsed.data.require2fa,
    });
    await logAudit({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      category: "admin",
      actor: access.userId,
      status: "success",
      severity: "info",
      targetType: "platform_settings",
      targetId: "security",
      targetLabel: "Security settings",
      metadata: { session_timeout_hours: parsed.data.sessionTimeoutHours, require_2fa: parsed.data.require2fa },
    });
    revalidatePath("/admin/settings");
    return { ok: true, data: null };
  } catch (error) {
    console.error("Failed to save security settings:", error);
    await logAudit({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      category: "admin",
      actor: access.userId,
      status: "failure",
      severity: "warning",
      targetType: "platform_settings",
      targetId: "security",
      targetLabel: "Security settings",
      metadata: { reason: "save_failed" },
    });
    return { ok: false, error: "Failed to save security settings." };
  }
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export async function saveEmailSettings(input: SaveEmailSettingsInput): Promise<ActionResult<null>> {
  const access = await requirePlatformAccess("platform:settings:manage");

  const parsed = saveEmailSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const data = parsed.data;
  try {
    await updatePlatformSettings({
      smtp_host: data.smtpHost?.trim() || null,
      smtp_port: data.smtpPort ?? null,
      smtp_user: data.smtpUser?.trim() || null,
      smtp_password: data.smtpPassword?.trim() || null,
      from_email: data.fromEmail?.trim() || null,
    });
    await logAudit({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      category: "admin",
      actor: access.userId,
      status: "success",
      severity: "info",
      targetType: "platform_settings",
      targetId: "email",
      targetLabel: "Email (SMTP) settings",
    });
    revalidatePath("/admin/settings");
    return { ok: true, data: null };
  } catch (error) {
    console.error("Failed to save email settings:", error);
    await logAudit({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      category: "admin",
      actor: access.userId,
      status: "failure",
      severity: "warning",
      targetType: "platform_settings",
      targetId: "email",
      targetLabel: "Email (SMTP) settings",
      metadata: { reason: "save_failed" },
    });
    return { ok: false, error: "Failed to save email settings." };
  }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export async function saveStorageSettings(input: SaveStorageSettingsInput): Promise<ActionResult<null>> {
  const access = await requirePlatformAccess("platform:settings:manage");

  const parsed = saveStorageSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const data = parsed.data;
  try {
    await updatePlatformSettings({
      r2_account_id: data.r2AccountId?.trim() || null,
      r2_access_key_id: data.r2AccessKeyId?.trim() || null,
      r2_access_key_secret: data.r2AccessKeySecret?.trim() || null,
      r2_bucket: data.r2Bucket?.trim() || null,
      r2_public_url: data.r2PublicUrl?.trim() || null,
    });
    await logAudit({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      category: "admin",
      actor: access.userId,
      status: "success",
      severity: "info",
      targetType: "platform_settings",
      targetId: "storage",
      targetLabel: "Storage settings",
    });
    revalidatePath("/admin/settings");
    return { ok: true, data: null };
  } catch (error) {
    console.error("Failed to save storage settings:", error);
    await logAudit({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      category: "admin",
      actor: access.userId,
      status: "failure",
      severity: "warning",
      targetType: "platform_settings",
      targetId: "storage",
      targetLabel: "Storage settings",
      metadata: { reason: "save_failed" },
    });
    return { ok: false, error: "Failed to save storage settings." };
  }
}

// ---------------------------------------------------------------------------
// Usage & Limits + System
// ---------------------------------------------------------------------------

export async function getAdminUsageSnapshot() {
  await requirePlatformAccess("platform:settings:manage");
  const stats = await getPlatformStats();
  const [settings, models] = await Promise.all([
    getPlatformSettings(),
    import("@/lib/db/repositories/ai-model.repo").then((m) => m.getModelCounts()),
  ]);
  return { stats, settings, models };
}
