import { getUserRole } from "../db/repositories/membership.repo";
import { hasPermission, type Permission } from "./roles";

export interface AccessContext {
  userId: string;
  workspaceId: string;
  role: "owner" | "admin" | "member";
}

/**
 * Core row-level security check, split out from the session-fused
 * `requireWorkspaceAccess` so it can be exercised directly in tests with two
 * distinct identities against live data.
 *
 * Throws on denial so callers short-circuit with a 401/403.
 */
export async function checkWorkspaceAccess(
  userId: string,
  workspaceId: string,
  permission: Permission,
): Promise<AccessContext> {
  const role = await getUserRole(workspaceId, userId);

  if (!role || (role !== "owner" && role !== "admin" && role !== "member")) {
    throw new Error("Forbidden: You are not a member of this workspace.");
  }

  if (!hasPermission(role, permission)) {
    throw new Error("Forbidden: Your role does not allow this action.");
  }

  return { userId, workspaceId, role };
}
