import { isSupabaseSuperAdmin } from "@/lib/auth/supabase-identity";
import { isSupabase } from "@/lib/auth/provider";

import { db } from "../client";
import type { PlatformRoleEntity } from "../entities";

export async function getPlatformRole(userId: string): Promise<PlatformRoleEntity | null> {
  try {
    const roles = await db.platformRole.getByUser(userId);
    return roles[0] ?? null;
  } catch {
    return null;
  }
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  if (isSupabase()) {
    return isSupabaseSuperAdmin(userId);
  }
  const role = await getPlatformRole(userId);
  return role?.role === "super_admin" && role?.status === "active";
}

export async function createPlatformRole(userId: string): Promise<PlatformRoleEntity> {
  return db.platformRole.create({
    user: userId,
    role: "super_admin",
    status: "active",
  });
}

export async function deletePlatformRole(userId: string): Promise<void> {
  const role = await getPlatformRole(userId);
  if (role) {
    await db.platformRole.delete(role.id);
  }
}

export async function getAllPlatformRoles(): Promise<PlatformRoleEntity[]> {
  if (isSupabase()) {
    try {
      const admin = (await import("@/lib/supabase/admin")).getSupabaseAdminClient();
      const { data, error } = await admin
        .from("platform_roles")
        .select("id,user_id,role,status,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) {
        return [];
      }
      return (data ?? []).map((row) => ({
        id: row.id,
        user: row.user_id,
        role: row.role,
        status: row.status,
        date_created: row.created_at,
        date_updated: row.updated_at,
      }));
    } catch {
      return [];
    }
  }
  try {
    return await db.platformRole.getMany({ sort: ["-date_created"] });
  } catch {
    return [];
  }
}
