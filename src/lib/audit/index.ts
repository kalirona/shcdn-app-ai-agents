import { headers } from "next/headers";

import { type AuditEventInput, recordAuditEvent } from "@/lib/db/repositories/audit.repo";

export type { AuditEventInput };

/**
 * Records an audit event with request context (IP + user agent) attached.
 * Fire-and-forget: the event write is never awaited and never throws, so audit
 * logging can never break an auth flow or admin action.
 *
 * Usage from a Server Action or Route Handler:
 *   await logAudit({ action: "auth.login", category: "auth", ... });
 */
export async function logAudit(input: AuditEventInput): Promise<void> {
  let ip: string | null = null;
  let userAgent: string | null = null;

  try {
    const headerStore = await headers();
    const fwd = headerStore.get("x-forwarded-for");
    ip = (fwd?.split(",")[0]?.trim() || headerStore.get("x-real-ip")) ?? null;
    userAgent = headerStore.get("user-agent");
  } catch {
    // headers() is unavailable outside a request context (e.g. build time).
  }

  await recordAuditEvent({ ...input, ipAddress: ip, userAgent });
}

/**
 * Convenience action constants so callers don't hand-roll strings.
 */
export const AUDIT_ACTIONS = {
  LOGIN: "auth.login",
  LOGIN_FAILED: "auth.login_failed",
  LOGOUT: "auth.logout",
  SIGNUP: "auth.signup",
  SIGNUP_FAILED: "auth.signup_failed",
  USER_BANNED: "admin.user.banned",
  USER_UNBANNED: "admin.user.unbanned",
  USER_SUSPENDED: "admin.user.suspended",
  USER_ACTIVATED: "admin.user.activated",
  USER_DELETED: "admin.user.deleted",
  USER_PASSWORD_RESET: "admin.user.password_reset",
  USER_FORCE_PASSWORD_RESET: "admin.user.force_password_reset",
  USER_MEMBERSHIP_REMOVED: "admin.user.membership_removed",
  SETTINGS_UPDATED: "admin.settings.updated",
  WORKSPACE_SUSPENDED: "admin.workspace.suspended",
  WORKSPACE_ACTIVATED: "admin.workspace.activated",
  WORKSPACE_CREATED: "workspace.created",
  WORKSPACE_UPDATED: "workspace.updated",
  MEMBER_INVITED: "workspace.member_invited",
  MEMBER_REMOVED: "workspace.member_removed",
  MEMBER_ROLE_CHANGED: "workspace.member_role_changed",
  MEMBER_INVITE_RESENT: "workspace.member_invite_resent",
  AUTHZ_DENIED: "security.authorization_denied",
  AUDIT_RETENTION_RUN: "admin.audit.retention_run",
} as const;
