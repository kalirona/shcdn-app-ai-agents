import { db } from "../client";
import type { PlatformUserEntity } from "../entities";

export interface UserFilters {
  q?: string;
  status?: string | null;
  limit?: number;
  offset?: number;
}

export interface UserListResult {
  users: PlatformUserEntity[];
  total: number;
}

function buildUserFilter(q?: string, status?: string | null): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const or: Record<string, unknown>[] = [];

  if (q?.trim()) {
    const term = q.trim();
    or.push({ email: { _icontains: term } });
    or.push({ first_name: { _icontains: term } });
    or.push({ last_name: { _icontains: term } });
    filter._or = or;
  }

  if (status && status !== "all") {
    if (status === "banned") {
      // Banned users have platform_banned = true (regardless of status field)
      filter.platform_banned = { _eq: true };
    } else {
      filter.status = { _eq: status };
    }
  }

  return filter;
}

/**
 * Searches platform users with optional text search and status filter.
 * `q` matches email, first_name, last_name.
 * `status` filters by Directus status or "banned" (platform_banned=true).
 */
export async function getUsers(filters: UserFilters = {}): Promise<UserListResult> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  try {
    const filter = buildUserFilter(filters.q, filters.status);

    const [users, count] = await Promise.all([
      db.user.getMany({
        filter,
        sort: ["-last_access"],
        limit,
        offset,
      }),
      db.user
        .getMany({
          filter,
          fields: ["id"],
          limit: -1,
        })
        .then((rows) => rows.length),
    ]);

    return { users, total: count };
  } catch (error) {
    console.error("[user.repo] failed to query users:", error);
    return { users: [], total: 0 };
  }
}

export async function getUserById(id: string): Promise<PlatformUserEntity | null> {
  try {
    return await db.user.getById(id);
  } catch (error) {
    console.error("[user.repo] failed to get user by id:", error);
    return null;
  }
}

export async function updateUser(id: string, data: Partial<PlatformUserEntity>): Promise<PlatformUserEntity | null> {
  try {
    return await db.user.update(id, data);
  } catch (error) {
    console.error("[user.repo] failed to update user:", error);
    return null;
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    await db.user.delete(id);
    return true;
  } catch (error) {
    console.error("[user.repo] failed to delete user:", error);
    return false;
  }
}

/**
 * Sets a user's platform banned status.
 * When banning: sets status="suspended" + platform_banned=true + ban_reason + banned_at.
 * When unbanning: sets status="active" + platform_banned=false + clears ban_reason/banned_at.
 */
export async function setUserBanned(
  userId: string,
  banned: boolean,
  reason?: string,
): Promise<PlatformUserEntity | null> {
  const now = new Date().toISOString();
  const data: Partial<PlatformUserEntity> = {
    platform_banned: banned,
    ban_reason: banned ? (reason ?? null) : null,
    banned_at: banned ? now : null,
    status: banned ? "suspended" : "active",
  };
  return updateUser(userId, data);
}

/**
 * Sets user status (active/invited/suspended/archived).
 * Does not affect platform_banned flag.
 */
export async function setUserStatus(
  userId: string,
  status: "active" | "invited" | "suspended" | "archived",
): Promise<PlatformUserEntity | null> {
  return updateUser(userId, { status });
}

/**
 * Resets a user's password via Directus admin API.
 */
export async function resetUserPassword(userId: string, newPassword: string): Promise<boolean> {
  try {
    await db.user.update(userId, { password: newPassword } as any);
    return true;
  } catch (error) {
    console.error("[user.repo] failed to reset user password:", error);
    return false;
  }
}

/**
 * Sets the force_password_reset flag on a user.
 */
export async function setForcePasswordReset(userId: string, force: boolean): Promise<PlatformUserEntity | null> {
  return updateUser(userId, { force_password_reset: force });
}
