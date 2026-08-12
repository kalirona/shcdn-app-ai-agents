import { isSuperAdmin as checkIsSuperAdmin } from "@/lib/db/repositories/platform-role.repo";

import { getAuthContext } from "./auth-context";
import { hasPlatformPermission, type PlatformPermission } from "./roles";

export interface PlatformAccessContext {
  userId: string;
  isSuperAdmin: boolean;
}

/**
 * Core platform-level authorization check.
 * Separate from workspace authorization - never reuses requireWorkspaceAccess().
 *
 * Throws on denial so callers short-circuit with a 401/403.
 */
export async function requirePlatformAccess(permission: PlatformPermission): Promise<PlatformAccessContext> {
  const { isAuthenticated, user } = await getAuthContext();

  if (!isAuthenticated || !user?.id) {
    throw new Error("Unauthorized: You must be logged in.");
  }

  const isSuperAdmin = await checkIsSuperAdmin(user.id);

  if (!isSuperAdmin) {
    throw new Error("Forbidden: Super Admin access required.");
  }

  if (!hasPlatformPermission("super_admin", permission)) {
    throw new Error("Forbidden: Your platform role does not allow this action.");
  }

  return { userId: user.id, isSuperAdmin: true };
}

/**
 * Non-throwing variant for conditional checks.
 */
export async function getPlatformAccess(permission: PlatformPermission): Promise<PlatformAccessContext | null> {
  try {
    return await requirePlatformAccess(permission);
  } catch {
    return null;
  }
}

/**
 * Quick boolean check for UI/visibility decisions.
 * Does not throw - returns false on any failure.
 */
export async function hasPlatformAccess(permission: PlatformPermission): Promise<boolean> {
  const access = await getPlatformAccess(permission);
  return access !== null;
}
