import { db } from "../client";
import type { AuditCategory, AuditLogEntity, AuditSeverity } from "../entities";

/**
 * Audit event contract. Fire-and-forget by design: callers must never await or
 * propagate failures from audit logging (it must not break a login/logout or an
 * admin action). recordAuditEvent() swallows every error and logs it.
 */
export interface AuditEventInput {
  /** Stable action key, e.g. "auth.login", "admin.user.suspend". */
  action: string;
  category: AuditCategory;
  /** Directus user ID of the actor. Omit for system/failed-login events. */
  actor?: string | null;
  /** Actor email, denormalized for search/display. */
  actorEmail?: string | null;
  status?: "success" | "failure";
  severity?: AuditSeverity;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  /** Arbitrary structured context (e.g. reason, old/new values). */
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await db.auditLog.create({
      action: input.action,
      category: input.category,
      actor: input.actor ?? null,
      actor_email: input.actorEmail ?? null,
      status: input.status ?? "success",
      severity: input.severity ?? "info",
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      target_label: input.targetLabel ?? null,
      metadata: input.metadata ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });
  } catch (error) {
    console.error(`[audit] failed to record ${input.category}.${input.action}:`, error);
  }
}

export interface AuditLogFilters {
  q?: string;
  category?: AuditCategory | null;
  severity?: AuditSeverity | null;
  status?: "success" | "failure" | null;
  limit?: number;
  offset?: number;
}

export interface AuditLogResult {
  events: AuditLogEntity[];
  total: number;
}

/**
 * Searches the audit trail. `q` matches actor email, action, target label, or
 * target id (case-insensitive substring via Directus _icontains).
 */
export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogResult> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  try {
    const filter: Record<string, unknown> = {};
    const or: Record<string, unknown>[] = [];

    if (filters.q?.trim()) {
      const q = filters.q.trim();
      or.push({ actor_email: { _icontains: q } });
      or.push({ action: { _icontains: q } });
      or.push({ target_label: { _icontains: q } });
      or.push({ target_id: { _icontains: q } });
      filter._or = or;
    }
    if (filters.category) {
      filter.category = { _eq: filters.category };
    }
    if (filters.severity) {
      filter.severity = { _eq: filters.severity };
    }
    if (filters.status) {
      filter.status = { _eq: filters.status };
    }

    const [events, count] = await Promise.all([
      db.auditLog.getMany({
        filter,
        sort: ["-date_created"],
        limit,
        offset,
      }),
      db.auditLog
        .getMany({
          filter,
          fields: ["id"],
          limit: -1,
        })
        .then((rows) => rows.length),
    ]);

    return { events, total: count };
  } catch (error) {
    console.error("[audit] failed to query audit logs:", error);
    return { events: [], total: 0 };
  }
}

/**
 * Compact counts for the /admin/audit metrics row. Returns zeros on failure so
 * the page never crashes because the collection is missing.
 */
export async function getAuditMetrics(): Promise<{
  total: number;
  security: number;
  admin: number;
  auth: number;
}> {
  try {
    const [all, security, admin, auth] = await Promise.all([
      db.auditLog.getMany({ fields: ["id"], limit: -1 }),
      db.auditLog.getMany({
        fields: ["id"],
        limit: -1,
        filter: { category: { _eq: "security" } },
      }),
      db.auditLog.getMany({
        fields: ["id"],
        limit: -1,
        filter: { category: { _eq: "admin" } },
      }),
      db.auditLog.getMany({
        fields: ["id"],
        limit: -1,
        filter: { category: { _eq: "auth" } },
      }),
    ]);
    return {
      total: all.length,
      security: security.length,
      admin: admin.length,
      auth: auth.length,
    };
  } catch (error) {
    console.error("[audit] failed to compute metrics:", error);
    return { total: 0, security: 0, admin: 0, auth: 0 };
  }
}
