"use server";

import { revalidatePath } from "next/cache";

import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { requirePlatformAccess } from "@/lib/auth/platform-access";
import { getMembershipsByUser } from "@/lib/db/repositories/membership.repo";
import { getPlatformRole } from "@/lib/db/repositories/platform-role.repo";
import {
  deleteUser,
  getUserById,
  getUsers,
  resetUserPassword,
  setForcePasswordReset,
  setUserBanned,
  setUserStatus,
} from "@/lib/db/repositories/user.repo";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// List / Search
// ---------------------------------------------------------------------------

export interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  status: string;
  platformBanned: boolean;
  lastAccess: string | null;
  platformRole: string | null;
  membershipCount: number;
  forcePasswordReset: boolean;
}

export async function getAdminUsers(
  q?: string,
  status?: string,
  page = 1,
  pageSize = 25,
): Promise<ActionResult<{ users: UserListItem[]; total: number }>> {
  try {
    await requirePlatformAccess("platform:users:read");

    // Normalize status filter
    let statusFilter: string | null = null;
    if (status && status !== "all") {
      const validStatuses = ["active", "invited", "suspended", "archived", "banned"] as const;
      type ValidStatus = (typeof validStatuses)[number];
      if (validStatuses.includes(status as ValidStatus)) {
        statusFilter = status;
      }
    }

    const { users, total } = await getUsers({
      q,
      status: statusFilter,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    // Get memberships and platform roles for each user
    const enriched = await Promise.all(
      users.map(async (u) => {
        const memberships = await getMembershipsByUser(u.id);
        const platformRole = await getPlatformRole(u.id);
        return {
          id: u.id,
          email: u.email,
          name: [u.first_name, u.last_name].filter(Boolean).join(" ") || null,
          status: u.platform_banned ? "banned" : u.status,
          platformBanned: u.platform_banned ?? false,
          lastAccess: u.last_access,
          platformRole: platformRole?.role ?? null,
          membershipCount: memberships.length,
          forcePasswordReset: u.force_password_reset ?? false,
        };
      }),
    );

    return { ok: true, data: { users: enriched, total } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch users";
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getAdminUserDetail(userId: string): Promise<
  ActionResult<{
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      status: string;
      platformBanned: boolean;
      banReason: string | null;
      bannedAt: string | null;
      forcePasswordReset: boolean;
      lastAccess: string | null;
      lastPage: string | null;
      provider: string;
      dateCreated: string | null;
      platformRole: string | null;
      memberships: Array<{
        id: string;
        workspaceId: string;
        workspaceName: string;
        role: string;
        status: string;
        joinedAt: string;
      }>;
    } | null;
  }>
> {
  try {
    await requirePlatformAccess("platform:users:read");

    const user = await getUserById(userId);
    if (!user) return { ok: false, error: "User not found" };

    const memberships = await getMembershipsByUser(user.id);
    const platformRole = await getPlatformRole(user.id);

    // Get workspace names for memberships
    const { getAllWorkspaces } = await import("@/lib/db/repositories/workspace.repo");
    const workspaces = await getAllWorkspaces();
    const wsMap = new Map(workspaces.map((w) => [w.id, w.name]));

    return {
      ok: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          status: user.platform_banned ? "banned" : user.status,
          platformBanned: user.platform_banned ?? false,
          banReason: user.ban_reason,
          bannedAt: user.banned_at,
          forcePasswordReset: user.force_password_reset ?? false,
          lastAccess: user.last_access,
          lastPage: user.last_page,
          provider: user.provider,
          dateCreated: user.date_created,
          platformRole: platformRole?.role ?? null,
          memberships: memberships.map((m) => ({
            id: m.id,
            workspaceId: m.workspace,
            workspaceName: wsMap.get(m.workspace) ?? m.workspace,
            role: m.role,
            status: m.status,
            joinedAt: m.date_created,
          })),
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch user detail";
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function suspendUser(userId: string): Promise<ActionResult<null>> {
  try {
    const access = await requirePlatformAccess("platform:users:manage");
    const user = await getUserById(userId);
    if (!user) return { ok: false, error: "User not found" };

    await setUserStatus(userId, "suspended");
    await logAudit({
      action: AUDIT_ACTIONS.USER_SUSPENDED,
      category: "user",
      actor: access.userId,
      status: "success",
      severity: "warning",
      targetType: "user",
      targetId: userId,
      targetLabel: user.email,
    });
    revalidatePath("/admin/users");
    return { ok: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to suspend user";
    return { ok: false, error: message };
  }
}

export async function activateUser(userId: string): Promise<ActionResult<null>> {
  try {
    const access = await requirePlatformAccess("platform:users:manage");
    const user = await getUserById(userId);
    if (!user) return { ok: false, error: "User not found" };

    await setUserStatus(userId, "active");
    await logAudit({
      action: AUDIT_ACTIONS.USER_ACTIVATED,
      category: "user",
      actor: access.userId,
      status: "success",
      severity: "info",
      targetType: "user",
      targetId: userId,
      targetLabel: user.email,
    });
    revalidatePath("/admin/users");
    return { ok: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to activate user";
    return { ok: false, error: message };
  }
}

export async function banUser(userId: string, reason: string): Promise<ActionResult<null>> {
  try {
    const access = await requirePlatformAccess("platform:users:manage");
    const user = await getUserById(userId);
    if (!user) return { ok: false, error: "User not found" };

    await setUserBanned(userId, true, reason);
    await logAudit({
      action: AUDIT_ACTIONS.USER_BANNED,
      category: "user",
      actor: access.userId,
      status: "success",
      severity: "critical",
      targetType: "user",
      targetId: userId,
      targetLabel: user.email,
      metadata: { reason },
    });
    revalidatePath("/admin/users");
    return { ok: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ban user";
    return { ok: false, error: message };
  }
}

export async function unbanUser(userId: string): Promise<ActionResult<null>> {
  try {
    const access = await requirePlatformAccess("platform:users:manage");
    const user = await getUserById(userId);
    if (!user) return { ok: false, error: "User not found" };

    await setUserBanned(userId, false);
    await logAudit({
      action: AUDIT_ACTIONS.USER_UNBANNED,
      category: "user",
      actor: access.userId,
      status: "success",
      severity: "info",
      targetType: "user",
      targetId: userId,
      targetLabel: user.email,
    });
    revalidatePath("/admin/users");
    return { ok: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to unban user";
    return { ok: false, error: message };
  }
}

export async function deleteUserAction(userId: string): Promise<ActionResult<null>> {
  try {
    const access = await requirePlatformAccess("platform:users:manage");
    const user = await getUserById(userId);
    if (!user) return { ok: false, error: "User not found" };

    await deleteUser(userId);
    await logAudit({
      action: AUDIT_ACTIONS.USER_DELETED,
      category: "user",
      actor: access.userId,
      status: "success",
      severity: "critical",
      targetType: "user",
      targetId: userId,
      targetLabel: user.email,
    });
    revalidatePath("/admin/users");
    return { ok: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    return { ok: false, error: message };
  }
}

export async function resetUserPasswordAction(userId: string, newPassword: string): Promise<ActionResult<null>> {
  try {
    const access = await requirePlatformAccess("platform:users:manage");
    const user = await getUserById(userId);
    if (!user) return { ok: false, error: "User not found" };

    const ok = await resetUserPassword(userId, newPassword);
    if (!ok) return { ok: false, error: "Failed to reset password" };

    await logAudit({
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      category: "user",
      actor: access.userId,
      status: "success",
      severity: "warning",
      targetType: "user",
      targetId: userId,
      targetLabel: user.email,
    });
    revalidatePath("/admin/users");
    return { ok: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset password";
    return { ok: false, error: message };
  }
}

export async function forcePasswordResetAction(userId: string): Promise<ActionResult<null>> {
  try {
    const access = await requirePlatformAccess("platform:users:manage");
    const user = await getUserById(userId);
    if (!user) return { ok: false, error: "User not found" };

    await setForcePasswordReset(userId, true);
    await logAudit({
      action: AUDIT_ACTIONS.USER_FORCE_PASSWORD_RESET,
      category: "user",
      actor: access.userId,
      status: "success",
      severity: "warning",
      targetType: "user",
      targetId: userId,
      targetLabel: user.email,
    });
    revalidatePath("/admin/users");
    return { ok: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to force password reset";
    return { ok: false, error: message };
  }
}
