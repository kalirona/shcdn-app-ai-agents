import { getAuthContext } from "@/lib/auth/auth-context";
import { hasPermission, type Permission, type Role } from "@/lib/auth/roles";
import * as membershipRepo from "@/lib/db/repositories/membership.repo";

export interface AccessContext {
  userId: string;
  workspaceId: string;
  role: Role;
}

/**
 * Row-level security gate for server actions.
 *
 * Verifies the current authenticated user is a member of the given workspace
 * and that their role grants the required permission. Returns an object with
 * the resolved role; throws on denial so callers short-circuit with a 401/403.
 */
export async function requireWorkspaceAccess(workspaceId: string, permission: Permission): Promise<AccessContext> {
  const { isAuthenticated, user } = await getAuthContext();

  if (!isAuthenticated || !user?.id) {
    throw new Error("Unauthorized: You must be logged in.");
  }

  const role = await membershipRepo.getUserRole(workspaceId, user.id);

  if (!role || (role !== "owner" && role !== "admin" && role !== "member")) {
    throw new Error("Forbidden: You are not a member of this workspace.");
  }

  if (!hasPermission(role, permission)) {
    throw new Error("Forbidden: Your role does not allow this action.");
  }

  return { userId: user.id, workspaceId, role };
}

/** Non-throwing variant that returns null when the caller lacks access. */
export async function getWorkspaceAccess(workspaceId: string, permission: Permission): Promise<AccessContext | null> {
  try {
    return await requireWorkspaceAccess(workspaceId, permission);
  } catch {
    return null;
  }
}
