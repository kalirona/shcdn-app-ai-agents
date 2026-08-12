import { getAuthContext } from "@/lib/auth/auth-context";
import type { Permission } from "@/lib/auth/roles";

import { type AccessContext, checkWorkspaceAccess } from "./access-core";

/**
 * Row-level security gate for server actions.
 *
 * Resolves the current authenticated user from the Logto session, then
 * delegates the membership/permission decision to `checkWorkspaceAccess`.
 * Throws on denial so callers short-circuit with a 401/403.
 */
export async function requireWorkspaceAccess(workspaceId: string, permission: Permission): Promise<AccessContext> {
  const { isAuthenticated, user } = await getAuthContext();

  if (!isAuthenticated || !user?.id) {
    throw new Error("Unauthorized: You must be logged in.");
  }

  return checkWorkspaceAccess(user.id, workspaceId, permission);
}

/** Non-throwing variant that returns null when the caller lacks access. */
export async function getWorkspaceAccess(workspaceId: string, permission: Permission): Promise<AccessContext | null> {
  try {
    return await requireWorkspaceAccess(workspaceId, permission);
  } catch {
    return null;
  }
}
