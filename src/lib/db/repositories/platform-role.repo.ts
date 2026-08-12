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
  try {
    return await db.platformRole.getMany({ sort: ["-date_created"] });
  } catch {
    return [];
  }
}
