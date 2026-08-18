import {
  getSupabasePlatformSettings,
  updateSupabasePlatformSettings,
} from "@/lib/auth/supabase-identity";
import { isSupabase } from "@/lib/auth/provider";

import { db } from "../client";
import type { PlatformSettingsEntity } from "../entities";

const DEFAULTS: Omit<PlatformSettingsEntity, "id" | "date_created" | "date_updated"> = {
  platform_name: "Agent AI",
  support_email: "",
  maintenance_mode: false,
  signup_enabled: true,
  default_workspace_plan: "starter",
  session_timeout_hours: 24,
  require_2fa: false,
  smtp_host: "",
  smtp_port: null,
  smtp_user: "",
  smtp_password: "",
  from_email: "",
  r2_account_id: "",
  r2_access_key_id: "",
  r2_access_key_secret: "",
  r2_bucket: "",
  r2_public_url: "",
};

export async function getPlatformSettings(): Promise<PlatformSettingsEntity | null> {
  if (isSupabase()) {
    const supabaseSettings = await getSupabasePlatformSettings();
    if (!supabaseSettings) {
      return { id: "", ...DEFAULTS, date_created: "", date_updated: "" };
    }
    return {
      id: supabaseSettings.id,
      platform_name: supabaseSettings.platform_name,
      support_email: supabaseSettings.support_email,
      maintenance_mode: supabaseSettings.maintenance_mode,
      signup_enabled: supabaseSettings.signup_enabled,
      default_workspace_plan: supabaseSettings.default_workspace_plan,
      session_timeout_hours: supabaseSettings.session_timeout_hours,
      require_2fa: supabaseSettings.require_2fa,
      smtp_host: supabaseSettings.smtp_host ?? "",
      smtp_port: supabaseSettings.smtp_port,
      smtp_user: supabaseSettings.smtp_user ?? "",
      smtp_password: "",
      from_email: supabaseSettings.from_email ?? "",
      r2_account_id: "",
      r2_access_key_id: "",
      r2_access_key_secret: "",
      r2_bucket: "",
      r2_public_url: "",
      date_created: supabaseSettings.date_created,
      date_updated: supabaseSettings.date_updated,
    };
  }

  try {
    const settings = await db.platformSettings.get();
    if (settings?.id) return settings;
    return { id: "", ...DEFAULTS, date_created: "", date_updated: "" };
  } catch {
    return { id: "", ...DEFAULTS, date_created: "", date_updated: "" };
  }
}

export async function updatePlatformSettings(
  data: Partial<PlatformSettingsEntity>,
): Promise<PlatformSettingsEntity | null> {
  if (isSupabase()) {
    const updates: Parameters<typeof updateSupabasePlatformSettings>[0] = {
      platform_name: data.platform_name ?? null,
      support_email: data.support_email ?? null,
      maintenance_mode: data.maintenance_mode ?? false,
      signup_enabled: data.signup_enabled ?? true,
      default_workspace_plan: data.default_workspace_plan ?? null,
      session_timeout_hours: data.session_timeout_hours ?? null,
      require_2fa: data.require_2fa ?? false,
      smtp_host: data.smtp_host?.trim() || null,
      smtp_port: data.smtp_port ?? null,
      smtp_user: data.smtp_user?.trim() || null,
      from_email: data.from_email?.trim() || null,
      r2_account_id: data.r2_account_id?.trim() || null,
      r2_access_key_id: data.r2_access_key_id?.trim() || null,
      r2_bucket: data.r2_bucket?.trim() || null,
      r2_public_url: data.r2_public_url?.trim() || null,
    };

    // Secret fields are only updated when a non-blank value is provided
    // ("leave blank to keep"), mirroring the admin form's placeholder hint.
    if (data.smtp_password?.trim()) {
      updates.smtp_password = data.smtp_password.trim();
    }
    if (data.r2_access_key_secret?.trim()) {
      updates.r2_access_key_secret = data.r2_access_key_secret.trim();
    }

    await updateSupabasePlatformSettings(updates);
    return getPlatformSettings();
  }

  try {
    return await db.platformSettings.update(data);
  } catch {
    return null;
  }
}
