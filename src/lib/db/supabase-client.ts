import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

import type {
  AgentEntity,
  AIDefaultsEntity,
  AIModelEntity,
  AIProviderEntity,
  AuditLogEntity,
  BookingEntity,
  CalendarIntegrationEntity,
  ConversationEntity,
  CustomerEntity,
  KnowledgeChunkEntity,
  KnowledgeSourceEntity,
  LeadEntity,
  MembershipEntity,
  MessageEntity,
  PlatformRoleEntity,
  PlatformSettingsEntity,
  PlatformUserEntity,
  ProviderCostLogEntity,
  WebhookDeliveryEntity,
  WebhookEntity,
  WebhookEventEntity,
  WorkspaceEntity,
} from "./entities";

/**
 * Supabase-backed mirror of the Directus `db` client surface.
 *
 * The Directus client used a static server-side token (full access) and relied
 * on the application layer (requireWorkspaceAccess / PERMISSIONS / origin +
 * rate-limit checks) for authorization. The Supabase equivalent is the
 * service-role admin client: it bypasses RLS exactly like the Directus token
 * did, while RLS stays enabled as defense-in-depth for any non-admin access
 * (e.g. direct PostgREST calls with user JWTs). No key is ever exposed to the
 * browser.
 *
 * Field names differ between the two schemas:
 *   Directus entity field  ->  Supabase column
 *   workspace              ->  workspace_id
 *   agent                  ->  agent_id
 *   conversation           ->  conversation_id
 *   customer               ->  customer_id
 *   source                 ->  knowledge_source_id
 *   user                   ->  user_id
 *   provider               ->  provider_id
 *   webhook                ->  webhook_id
 *   actor                  ->  actor_id
 *   date_created           ->  created_at
 *   date_updated           ->  updated_at
 * Every method below maps both directions so callers keep using the Directus
 * entity shape.
 */

interface TableConfig {
  table: string;
  /** entityField -> supabase column for fields whose names differ. */
  map: Record<string, string>;
}

interface DirectusQuery {
  filter?: Record<string, unknown>;
  fields?: string[];
  sort?: string[];
  limit?: number;
  offset?: number;
}

function toColumn(config: TableConfig, entityField: string): string {
  return config.map[entityField] ?? entityField;
}

function toEntityField(config: TableConfig, column: string): string {
  for (const [entityField, supabaseColumn] of Object.entries(config.map)) {
    if (supabaseColumn === column) return entityField;
  }
  return column;
}

function rowToEntity<T>(config: TableConfig, row: Record<string, unknown>): T {
  const entity: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) {
    entity[toEntityField(config, column)] = value;
  }
  return entity as T;
}

/** Strips server-managed fields and maps entity fields to Supabase columns. */
function toWriteRow(config: TableConfig, data: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(data)) {
    if (field === "id" || field === "date_created" || field === "date_updated") continue;
    row[toColumn(config, field)] = value;
  }
  return row;
}

function isFilterValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function buildSelect(config: TableConfig, fields?: string[]): string {
  if (!fields || fields.length === 0) return "*";
  return fields.map((f) => toColumn(config, f)).join(",");
}

/** Minimal postgrest query-builder surface used by this module. */
interface QueryBuilder {
  select: (columns: string) => QueryBuilder;
  or: (query: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  ilike: (column: string, pattern: string) => QueryBuilder;
  gte: (column: string, value: unknown) => QueryBuilder;
  lte: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  range: (from: number, to: number) => Promise<{ data: unknown; error: unknown }>;
}

function tableQuery(config: TableConfig, fields?: string[]): QueryBuilder {
  const client = getSupabaseAdminClient();
  return client.from(config.table).select(buildSelect(config, fields)) as unknown as QueryBuilder;
}

/**
 * Applies a Directus-style filter (`{ field: { _eq: v } }`, `_in`, `_icontains`,
 * `_gte`, `_lte`, plus a top-level `_or` array) to a Supabase query builder.
 */
function applyFilter(builder: QueryBuilder, filter: Record<string, unknown>, config: TableConfig) {
  let qb = builder;
  for (const [key, value] of Object.entries(filter)) {
    if (key === "_or" && Array.isArray(value)) {
      const orParts: string[] = [];
      for (const cond of value as Record<string, unknown>[]) {
        for (const [condKey, condValue] of Object.entries(cond)) {
          const column = toColumn(config, condKey);
          if (isFilterValue(condValue)) {
            if (condValue._icontains != null) orParts.push(`${column}.ilike.*${condValue._icontains}*`);
            else if (condValue._eq != null) orParts.push(`${column}.eq.${condValue._eq}`);
            else if (Array.isArray(condValue._in)) orParts.push(`${column}.in.(${condValue._in.join(",")})`);
          }
        }
      }
      if (orParts.length > 0) {
        qb = qb.or(orParts.join(","));
      }
      continue;
    }

    const column = toColumn(config, key);
    if (isFilterValue(value)) {
      if (value._eq != null) qb = qb.eq(column, value._eq);
      if (value._in != null) qb = qb.in(column, value._in as unknown[]);
      if (value._icontains != null) qb = qb.ilike(column, `%${value._icontains}%`);
      if (value._gte != null) qb = qb.gte(column, value._gte);
      if (value._lte != null) qb = qb.lte(column, value._lte);
    } else {
      qb = qb.eq(column, value);
    }
  }
  return qb;
}

function throwSupabase(operation: string, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`Supabase ${operation} failed: ${message}`);
}

/**
 * Fetches all matching rows, paginating when `limit === -1` (Directus semantics:
 * no limit = every row) or when no limit is supplied.
 */
async function runQuery<T>(
  config: TableConfig,
  query?: DirectusQuery,
  extra?: (qb: QueryBuilder) => QueryBuilder,
): Promise<T[]> {
  let qb = tableQuery(config, query?.fields);

  if (query?.filter) {
    qb = applyFilter(qb, query.filter, config);
  }
  if (extra) {
    qb = extra(qb);
  }
  for (const sort of query?.sort ?? []) {
    const descending = sort.startsWith("-");
    const column = toColumn(config, descending ? sort.slice(1) : sort);
    qb = qb.order(column, { ascending: !descending });
  }

  const offset = query?.offset ?? 0;
  const all: Record<string, unknown>[] = [];

  if (query?.limit != null && query.limit > 0) {
    const { data, error } = await qb.range(offset, offset + query.limit - 1);
    if (error) throwSupabase(config.table, error);
    all.push(...((data as Record<string, unknown>[]) ?? []));
  } else {
    // limit === -1 or unset: fetch everything.
    const pageSize = 1000;
    let start = offset;
    for (;;) {
      const { data, error } = await qb.range(start, start + pageSize - 1);
      if (error) throwSupabase(config.table, error);
      const page = (data as Record<string, unknown>[]) ?? [];
      all.push(...page);
      if (page.length < pageSize) break;
      start += pageSize;
    }
  }

  return all.map((row) => rowToEntity<T>(config, row));
}

async function createRow<T>(config: TableConfig, data: Record<string, unknown>): Promise<T> {
  const client = getSupabaseAdminClient();
  const { data: created, error } = await client
    .from(config.table)
    .insert(toWriteRow(config, data))
    .select()
    .single();
  if (error) throwSupabase(config.table, error);
  return rowToEntity<T>(config, created as Record<string, unknown>);
}

async function updateRow<T>(config: TableConfig, id: string, data: Record<string, unknown>): Promise<T> {
  const client = getSupabaseAdminClient();
  const { data: updated, error } = await client
    .from(config.table)
    .update(toWriteRow(config, data))
    .eq("id", id)
    .select()
    .single();
  if (error) throwSupabase(config.table, error);
  return rowToEntity<T>(config, updated as Record<string, unknown>);
}

async function deleteRow(config: TableConfig, id: string): Promise<void> {
  const client = getSupabaseAdminClient();
  const { error } = await client.from(config.table).delete().eq("id", id);
  if (error) throwSupabase(config.table, error);
}

// --- Shared column maps (entity field -> Supabase column) --------------------

const timestamps = { date_created: "created_at", date_updated: "updated_at" };

const workspaceConfig: TableConfig = { table: "workspaces", map: timestamps };

const membershipConfig: TableConfig = {
  table: "workspace_members",
  map: { workspace: "workspace_id", user: "user_id", ...timestamps },
};

const agentConfig: TableConfig = { table: "agents", map: { workspace: "workspace_id", ...timestamps } };

const knowledgeSourceConfig: TableConfig = {
  table: "knowledge_sources",
  map: { workspace: "workspace_id", agent: "agent_id", ...timestamps },
};

const knowledgeChunkConfig: TableConfig = {
  table: "knowledge_chunks",
  map: { source: "knowledge_source_id", ...timestamps },
};

const calendarIntegrationConfig: TableConfig = {
  table: "calendar_integrations",
  map: { workspace: "workspace_id", ...timestamps },
};

const conversationConfig: TableConfig = {
  table: "conversations",
  map: { workspace: "workspace_id", agent: "agent_id", customer: "customer_id", ...timestamps },
};

const messageConfig: TableConfig = {
  table: "messages",
  map: { conversation: "conversation_id", date_created: "created_at" },
};

const leadConfig: TableConfig = { table: "leads", map: { workspace: "workspace_id", ...timestamps } };

const bookingConfig: TableConfig = { table: "bookings", map: { workspace: "workspace_id", ...timestamps } };

const customerConfig: TableConfig = { table: "customers", map: { workspace: "workspace_id", ...timestamps } };

const webhookConfig: TableConfig = { table: "webhooks", map: { workspace: "workspace_id", ...timestamps } };

const webhookDeliveryConfig: TableConfig = {
  table: "webhook_deliveries",
  map: { webhook: "webhook_id", ...timestamps },
};

const webhookEventConfig: TableConfig = {
  table: "webhook_events",
  map: { workspace: "workspace_id", ...timestamps },
};

const platformRoleConfig: TableConfig = {
  table: "platform_roles",
  map: { user: "user_id", ...timestamps },
};

const platformSettingsConfig: TableConfig = { table: "platform_settings", map: timestamps };

const aiProviderConfig: TableConfig = { table: "ai_providers", map: timestamps };

const aiModelConfig: TableConfig = {
  table: "ai_models",
  map: { provider: "provider_id", ...timestamps },
};

const aiDefaultsConfig: TableConfig = { table: "ai_defaults", map: timestamps };

const auditLogConfig: TableConfig = {
  table: "audit_logs",
  map: { actor: "actor_id", date_created: "created_at" },
};

const costLogConfig: TableConfig = {
  table: "ai_usage",
  map: { workspace: "workspace_id", agent: "agent_id", user: "user_id", ...timestamps },
};

// --- Fixed singleton IDs (matching the Supabase schema) -----------------------

const AI_DEFAULTS_ID = "00000000-0000-0000-0000-00000000d001";
const PLATFORM_SETTINGS_ID = "00000000-0000-0000-0000-00000000d002";

// --- Message workspace/agent resolution --------------------------------------
// The Supabase `messages` table has no workspace_id/agent_id columns (they are
// derived from the conversation), unlike Directus. Resolve via conversations.

async function resolveConversationIds(filter: Record<string, unknown>): Promise<string[]> {
  const conversations = await runQuery<ConversationEntity>(conversationConfig, {
    filter,
    fields: ["id"],
  });
  return conversations.map((c) => c.id);
}

// --- Users (Supabase profiles + auth.users) ----------------------------------
// Directus `/users` maps to `public.profiles` (extension fields) with the id
// being the auth.users id. role/token/last_page/provider are not stored in
// Supabase; they are filled with defaults to satisfy PlatformUserEntity.

const userConfig: TableConfig = {
  table: "profiles",
  map: { date_created: "created_at" },
};

function profileToUser(row: Record<string, unknown>): PlatformUserEntity {
  return {
    id: String(row.user_id ?? ""),
    email: String(row.email ?? ""),
    first_name: (row.first_name as string | null) ?? null,
    last_name: (row.last_name as string | null) ?? null,
    status: (row.status as string) ?? "active",
    role: null,
    token: null,
    last_access: (row.last_access as string | null) ?? null,
    last_page: null,
    provider: "email",
    external_identifier: null,
    platform_banned: (row.platform_banned as boolean | null) ?? false,
    ban_reason: (row.ban_reason as string | null) ?? null,
    banned_at: (row.banned_at as string | null) ?? null,
    force_password_reset: (row.force_password_reset as boolean | null) ?? false,
    date_created: (row.created_at as string | null) ?? null,
  };
}

async function queryUsers(query?: DirectusQuery): Promise<PlatformUserEntity[]> {
  const mappedQuery: DirectusQuery = {
    ...query,
    fields: query?.fields?.length
      ? query.fields.map((f) => (f === "id" ? "user_id" : f === "date_created" ? "created_at" : f))
      : undefined,
  };
  if (query?.filter) {
    mappedQuery.filter = {
      ...query.filter,
      id: undefined,
      user_id: query.filter.id,
    };
    delete mappedQuery.filter.id;
    for (const cond of Object.values(query.filter._or ?? [])) {
      const orCond = cond as Record<string, unknown>;
      if (orCond.id !== undefined) {
        orCond.user_id = orCond.id;
        delete orCond.id;
      }
    }
  }
  const rows = await runQuery<Record<string, unknown>>(userConfig, mappedQuery);
  return rows.map(profileToUser);
}

// --- The Supabase-backed db client -------------------------------------------

export const supabaseDb = {
  workspace: {
    create: (
      data: Omit<
        WorkspaceEntity,
        | "id"
        | "date_created"
        | "date_updated"
        | "status"
        | "plan"
        | "subscription_status"
        | "payment_provider"
        | "payment_provider_subscription_id"
        | "payment_provider_customer_id"
        | "current_period_start"
        | "current_period_end"
        | "cancel_at_period_end"
      >,
    ) => createRow<WorkspaceEntity>(workspaceConfig, { ...data, status: "active" }),
    getById: (id: string) => runQuery<WorkspaceEntity>(workspaceConfig, { filter: { id: { _eq: id } } }).then((r) => r[0] ?? null),
    getMany: (query?: DirectusQuery) => runQuery<WorkspaceEntity>(workspaceConfig, query),
    update: (id: string, data: Partial<WorkspaceEntity>) => updateRow<WorkspaceEntity>(workspaceConfig, id, data),
    delete: (id: string) => deleteRow(workspaceConfig, id),
  },

  membership: {
    create: (
      data: Omit<MembershipEntity, "id" | "date_created" | "date_updated" | "status"> & {
        status?: "active" | "invited" | "inactive";
      },
    ) => createRow<MembershipEntity>(membershipConfig, { ...data, status: data.status ?? "active" }),
    getById: (id: string) =>
      runQuery<MembershipEntity>(membershipConfig, { filter: { id: { _eq: id } } }).then((r) => r[0] ?? null),
    getMany: (query?: DirectusQuery) => runQuery<MembershipEntity>(membershipConfig, query),
    getByWorkspace: (workspaceId: string) =>
      runQuery<MembershipEntity>(membershipConfig, {
        filter: { workspace: { _eq: workspaceId } },
        sort: ["-role", "date_created"],
      }),
    getByUser: (userId: string) =>
      runQuery<MembershipEntity>(membershipConfig, { filter: { user: { _eq: userId } } }),
    update: (id: string, data: Partial<MembershipEntity>) => updateRow<MembershipEntity>(membershipConfig, id, data),
    delete: (id: string) => deleteRow(membershipConfig, id),
  },

  agent: {
    create: (data: Omit<AgentEntity, "id" | "date_created" | "date_updated" | "status">) =>
      createRow<AgentEntity>(agentConfig, { ...data, status: "active" }),
    getById: (id: string) =>
      runQuery<AgentEntity>(agentConfig, { filter: { id: { _eq: id } } }).then((r) => r[0] ?? null),
    getMany: (query?: DirectusQuery) => runQuery<AgentEntity>(agentConfig, query),
    getByWorkspace: (workspaceId: string) =>
      runQuery<AgentEntity>(agentConfig, {
        filter: { workspace: { _eq: workspaceId } },
        sort: ["-date_created"],
      }),
    update: (id: string, data: Partial<AgentEntity>) => updateRow<AgentEntity>(agentConfig, id, data),
    delete: (id: string) => deleteRow(agentConfig, id),
  },

  knowledgeSource: {
    create: (data: Omit<KnowledgeSourceEntity, "id" | "date_created" | "date_updated" | "status" | "chunk_count">) =>
      createRow<KnowledgeSourceEntity>(knowledgeSourceConfig, { ...data, status: "pending", chunk_count: 0 }),
    getById: (id: string) =>
      runQuery<KnowledgeSourceEntity>(knowledgeSourceConfig, { filter: { id: { _eq: id } } }).then((r) => r[0] ?? null),
    getByAgent: (agentId: string) =>
      runQuery<KnowledgeSourceEntity>(knowledgeSourceConfig, {
        filter: { agent: { _eq: agentId } },
        sort: ["-date_created"],
      }),
    getByWorkspace: (workspaceId: string) =>
      runQuery<KnowledgeSourceEntity>(knowledgeSourceConfig, {
        filter: { workspace: { _eq: workspaceId } },
        sort: ["-date_created"],
      }),
    update: (id: string, data: Partial<KnowledgeSourceEntity>) =>
      updateRow<KnowledgeSourceEntity>(knowledgeSourceConfig, id, data),
    delete: (id: string) => deleteRow(knowledgeSourceConfig, id),
  },

  knowledgeChunk: {
    create: async (data: Omit<KnowledgeChunkEntity, "id">) => {
      const sourceId = data.source;
      const source = await runQuery<KnowledgeSourceEntity>(knowledgeSourceConfig, {
        filter: { id: { _eq: sourceId } },
        fields: ["id", "workspace", "agent"],
      }).then((r) => r[0] ?? null);

      const row: Record<string, unknown> = {
        knowledge_source_id: sourceId,
        content: data.content,
        index: data.index,
        metadata: data.metadata ?? {},
        content_hash: data.content_hash ?? null,
        token_count: data.token_count ?? null,
        embedding: Array.isArray(data.embedding) ? JSON.stringify(data.embedding) : data.embedding,
      };
      if (source) {
        row.workspace_id = source.workspace;
        row.agent_id = source.agent;
      }

      const client = getSupabaseAdminClient();
      const { data: created, error } = await client
        .from("knowledge_chunks")
        .insert(row)
        .select("id,knowledge_source_id,content,metadata,embedding,index,content_hash,token_count,created_at,updated_at")
        .single();
      if (error) throwSupabase("knowledge_chunks", error);
      return rowToEntity<KnowledgeChunkEntity>(knowledgeChunkConfig, created as Record<string, unknown>);
    },

    getBySource: (sourceId: string) =>
      runQuery<KnowledgeChunkEntity>(knowledgeChunkConfig, {
        filter: { source: { _eq: sourceId } },
        sort: ["index"],
      }),

    getMany: (query?: DirectusQuery) => runQuery<KnowledgeChunkEntity>(knowledgeChunkConfig, query),

    update: (id: string, data: Partial<KnowledgeChunkEntity>) => {
      const row: Record<string, unknown> = { ...data };
      if (Array.isArray(row.embedding)) {
        row.embedding = JSON.stringify(row.embedding);
      }
      return updateRow<KnowledgeChunkEntity>(knowledgeChunkConfig, id, row);
    },

    deleteBySource: async (sourceId: string) => {
      const client = getSupabaseAdminClient();
      const { error } = await client.from("knowledge_chunks").delete().eq("knowledge_source_id", sourceId);
      if (error) throwSupabase("knowledge_chunks", error);
    },
  },

  calendarIntegration: {
    create: (data: Omit<CalendarIntegrationEntity, "id" | "date_created" | "date_updated" | "status">) =>
      createRow<CalendarIntegrationEntity>(calendarIntegrationConfig, { ...data, status: "disconnected" }),
    getById: (id: string) =>
      runQuery<CalendarIntegrationEntity>(calendarIntegrationConfig, { filter: { id: { _eq: id } } }).then(
        (r) => r[0] ?? null,
      ),
    getByWorkspace: (workspaceId: string) =>
      runQuery<CalendarIntegrationEntity>(calendarIntegrationConfig, {
        filter: { workspace: { _eq: workspaceId } },
        sort: ["-date_created"],
      }),
    update: (id: string, data: Partial<CalendarIntegrationEntity>) =>
      updateRow<CalendarIntegrationEntity>(calendarIntegrationConfig, id, data),
    delete: (id: string) => deleteRow(calendarIntegrationConfig, id),
  },

  conversation: {
    create: (data: Omit<ConversationEntity, "id" | "date_created" | "date_updated" | "status">) =>
      createRow<ConversationEntity>(conversationConfig, { ...data, status: "active" }),
    getById: (id: string) =>
      runQuery<ConversationEntity>(conversationConfig, { filter: { id: { _eq: id } } }).then((r) => r[0] ?? null),
    getBySession: (sessionId: string) =>
      runQuery<ConversationEntity>(conversationConfig, {
        filter: { customer: { _eq: sessionId } },
        limit: 1,
        sort: ["-date_created"],
      }),
    getMany: (query?: DirectusQuery) => runQuery<ConversationEntity>(conversationConfig, query),
    getByWorkspace: (workspaceId: string, status?: string) =>
      runQuery<ConversationEntity>(conversationConfig, {
        filter: {
          workspace: { _eq: workspaceId },
          ...(status ? { status: { _eq: status } } : {}),
        },
        sort: ["-date_created"],
      }),
    getByAgent: (agentId: string) =>
      runQuery<ConversationEntity>(conversationConfig, {
        filter: { agent: { _eq: agentId } },
        sort: ["-date_created"],
      }),
    update: (id: string, data: Partial<ConversationEntity>) =>
      updateRow<ConversationEntity>(conversationConfig, id, data),
    delete: (id: string) => deleteRow(conversationConfig, id),
  },

  message: {
    create: (data: Omit<MessageEntity, "id" | "date_created">) =>
      createRow<MessageEntity>(messageConfig, data),
    getByConversation: (conversationId: string) =>
      runQuery<MessageEntity>(messageConfig, {
        filter: { conversation: { _eq: conversationId } },
        sort: ["date_created"],
      }),
    getByConversations: async (conversationIds: string[]) => {
      if (conversationIds.length === 0) return [];
      const all: MessageEntity[] = [];
      for (let i = 0; i < conversationIds.length; i += 100) {
        const batch = conversationIds.slice(i, i + 100);
        const page = await runQuery<MessageEntity>(messageConfig, {
          filter: { conversation: { _in: batch } },
          sort: ["date_created"],
        });
        all.push(...page);
      }
      return all;
    },
    getByWorkspace: async (workspaceId: string) => {
      const ids = await resolveConversationIds({ workspace: { _eq: workspaceId } });
      return ids.length === 0 ? [] : (await supabaseDb.message.getByConversations(ids));
    },
    getByAgent: async (agentId: string) => {
      const ids = await resolveConversationIds({ agent: { _eq: agentId } });
      return ids.length === 0 ? [] : (await supabaseDb.message.getByConversations(ids));
    },
    delete: (id: string) => deleteRow(messageConfig, id),
  },

  lead: {
    create: (data: Omit<LeadEntity, "id" | "date_created" | "date_updated">) =>
      createRow<LeadEntity>(leadConfig, data),
    getById: (id: string) => runQuery<LeadEntity>(leadConfig, { filter: { id: { _eq: id } } }).then((r) => r[0] ?? null),
    getByWorkspace: (workspaceId: string) =>
      runQuery<LeadEntity>(leadConfig, {
        filter: { workspace: { _eq: workspaceId } },
        sort: ["-date_created"],
      }),
    update: (id: string, data: Partial<LeadEntity>) => updateRow<LeadEntity>(leadConfig, id, data),
    delete: (id: string) => deleteRow(leadConfig, id),
  },

  booking: {
    create: (data: Omit<BookingEntity, "id" | "date_created" | "date_updated">) =>
      createRow<BookingEntity>(bookingConfig, data),
    getById: (id: string) => runQuery<BookingEntity>(bookingConfig, { filter: { id: { _eq: id } } }).then((r) => r[0] ?? null),
    getByWorkspace: (workspaceId: string) =>
      runQuery<BookingEntity>(bookingConfig, {
        filter: { workspace: { _eq: workspaceId } },
        sort: ["-date_created"],
      }),
    update: (id: string, data: Partial<BookingEntity>) => updateRow<BookingEntity>(bookingConfig, id, data),
    delete: (id: string) => deleteRow(bookingConfig, id),
  },

  customer: {
    create: (data: Omit<CustomerEntity, "id" | "date_created" | "date_updated">) =>
      createRow<CustomerEntity>(customerConfig, data),
    getById: (id: string) => runQuery<CustomerEntity>(customerConfig, { filter: { id: { _eq: id } } }).then((r) => r[0] ?? null),
    getByWorkspace: (workspaceId: string) =>
      runQuery<CustomerEntity>(customerConfig, {
        filter: { workspace: { _eq: workspaceId } },
        sort: ["-date_created"],
      }),
    update: (id: string, data: Partial<CustomerEntity>) => updateRow<CustomerEntity>(customerConfig, id, data),
    delete: (id: string) => deleteRow(customerConfig, id),
  },

  webhook: {
    create: (data: Omit<WebhookEntity, "id" | "date_created" | "date_updated" | "active"> & { active?: boolean }) =>
      createRow<WebhookEntity>(webhookConfig, { ...data, active: data.active ?? true }),
    getById: (id: string) => runQuery<WebhookEntity>(webhookConfig, { filter: { id: { _eq: id } } }).then((r) => r[0] ?? null),
    getMany: (query?: DirectusQuery) => runQuery<WebhookEntity>(webhookConfig, query),
    getByWorkspace: (workspaceId: string) =>
      runQuery<WebhookEntity>(webhookConfig, {
        filter: { workspace: { _eq: workspaceId } },
        sort: ["-date_created"],
      }),
    update: (id: string, data: Partial<WebhookEntity>) => updateRow<WebhookEntity>(webhookConfig, id, data),
    delete: (id: string) => deleteRow(webhookConfig, id),
  },

  webhookDelivery: {
    create: (data: Omit<WebhookDeliveryEntity, "id" | "date_created" | "date_updated">) =>
      createRow<WebhookDeliveryEntity>(webhookDeliveryConfig, data),
    getByWebhook: (webhookId: string) =>
      runQuery<WebhookDeliveryEntity>(webhookDeliveryConfig, {
        filter: { webhook: { _eq: webhookId } },
        sort: ["-date_created"],
      }),
    getMany: (query?: DirectusQuery) => runQuery<WebhookDeliveryEntity>(webhookDeliveryConfig, query),
  },

  webhookEvent: {
    create: (data: Omit<WebhookEventEntity, "id" | "date_created" | "date_updated">) =>
      createRow<WebhookEventEntity>(webhookEventConfig, data),
    getByEventId: (provider: string, eventId: string) =>
      runQuery<WebhookEventEntity>(webhookEventConfig, {
        filter: { provider: { _eq: provider }, event_id: { _eq: eventId } },
        limit: 1,
      }),
    getMany: (query?: DirectusQuery) => runQuery<WebhookEventEntity>(webhookEventConfig, query),
  },

  platformRole: {
    create: (
      data: Omit<PlatformRoleEntity, "id" | "date_created" | "date_updated" | "status"> & {
        status?: "active" | "inactive";
      },
    ) => createRow<PlatformRoleEntity>(platformRoleConfig, { ...data, status: data.status ?? "active" }),
    getById: (id: string) =>
      runQuery<PlatformRoleEntity>(platformRoleConfig, { filter: { id: { _eq: id } } }).then((r) => r[0] ?? null),
    getMany: (query?: DirectusQuery) => runQuery<PlatformRoleEntity>(platformRoleConfig, query),
    getByUser: (userId: string) =>
      runQuery<PlatformRoleEntity>(platformRoleConfig, { filter: { user: { _eq: userId } } }),
    update: (id: string, data: Partial<PlatformRoleEntity>) =>
      updateRow<PlatformRoleEntity>(platformRoleConfig, id, data),
    delete: (id: string) => deleteRow(platformRoleConfig, id),
  },

  platformSettings: {
    get: async () => {
      const client = getSupabaseAdminClient();
      const { data, error } = await client
        .from("platform_settings")
        .select("*")
        .eq("id", PLATFORM_SETTINGS_ID)
        .maybeSingle();
      if (error) throwSupabase("platform_settings", error);
      return data ? rowToEntity<PlatformSettingsEntity>(platformSettingsConfig, data as Record<string, unknown>) : null;
    },
    update: async (data: Partial<PlatformSettingsEntity>) => {
      const client = getSupabaseAdminClient();
      const { data: updated, error } = await client
        .from("platform_settings")
        .upsert({ id: PLATFORM_SETTINGS_ID, ...toWriteRow(platformSettingsConfig, data) })
        .select()
        .single();
      if (error) throwSupabase("platform_settings", error);
      return rowToEntity<PlatformSettingsEntity>(platformSettingsConfig, updated as Record<string, unknown>);
    },
  },

  aiProvider: {
    create: (
      data: Omit<AIProviderEntity, "id" | "date_created" | "date_updated" | "status" | "last_tested_at" | "last_error"> & {
        status?: AIProviderEntity["status"];
        last_tested_at?: string | null;
        last_error?: string | null;
      },
    ) =>
      createRow<AIProviderEntity>(aiProviderConfig, {
        ...data,
        status: data.status ?? "untested",
        last_tested_at: data.last_tested_at ?? null,
        last_error: data.last_error ?? null,
      }),
    getById: (id: string) =>
      runQuery<AIProviderEntity>(aiProviderConfig, { filter: { id: { _eq: id } } }).then((r) => r[0] ?? null),
    getMany: (query?: DirectusQuery) => runQuery<AIProviderEntity>(aiProviderConfig, query),
    getByKey: (providerKey: string) =>
      runQuery<AIProviderEntity>(aiProviderConfig, {
        filter: { provider_key: { _eq: providerKey } },
        limit: 1,
      }),
    update: (id: string, data: Partial<AIProviderEntity>) =>
      updateRow<AIProviderEntity>(aiProviderConfig, id, data),
    delete: (id: string) => deleteRow(aiProviderConfig, id),
  },

  aiModel: {
    create: (
      data: Omit<AIModelEntity, "id" | "date_created" | "date_updated"> & {
        source?: AIModelEntity["source"];
      },
    ) => createRow<AIModelEntity>(aiModelConfig, { ...data, source: data.source ?? "discovered" }),
    getById: (id: string) =>
      runQuery<AIModelEntity>(aiModelConfig, { filter: { id: { _eq: id } } }).then((r) => r[0] ?? null),
    getMany: (query?: DirectusQuery) => runQuery<AIModelEntity>(aiModelConfig, query),
    getByProvider: (providerId: string) =>
      runQuery<AIModelEntity>(aiModelConfig, {
        filter: { provider: { _eq: providerId } },
        sort: ["model_id"],
      }),
    update: (id: string, data: Partial<AIModelEntity>) => updateRow<AIModelEntity>(aiModelConfig, id, data),
    delete: (id: string) => deleteRow(aiModelConfig, id),
  },

  aiDefaults: {
    get: async () => {
      const client = getSupabaseAdminClient();
      const { data, error } = await client
        .from("ai_defaults")
        .select("*")
        .eq("id", AI_DEFAULTS_ID)
        .maybeSingle();
      if (error) throwSupabase("ai_defaults", error);
      return data ? rowToEntity<AIDefaultsEntity>(aiDefaultsConfig, data as Record<string, unknown>) : null;
    },
    update: async (data: Partial<AIDefaultsEntity>) => {
      const client = getSupabaseAdminClient();
      const { data: updated, error } = await client
        .from("ai_defaults")
        .upsert({ id: AI_DEFAULTS_ID, ...toWriteRow(aiDefaultsConfig, data) })
        .select()
        .single();
      if (error) throwSupabase("ai_defaults", error);
      return rowToEntity<AIDefaultsEntity>(aiDefaultsConfig, updated as Record<string, unknown>);
    },
  },

  auditLog: {
    create: (data: Omit<AuditLogEntity, "id" | "date_created">) => createRow<AuditLogEntity>(auditLogConfig, data),
    getMany: (query?: DirectusQuery) => runQuery<AuditLogEntity>(auditLogConfig, query),
  },

  user: {
    getMany: (query?: DirectusQuery) => queryUsers(query),
    getById: async (id: string) => {
      const rows = await queryUsers({ filter: { id: { _eq: id } } });
      return rows[0] ?? null;
    },
    update: async (id: string, data: Partial<PlatformUserEntity>) => {
      const client = getSupabaseAdminClient();
      const profileData: Record<string, unknown> = {};
      if (data.first_name !== undefined) profileData.first_name = data.first_name;
      if (data.last_name !== undefined) profileData.last_name = data.last_name;
      if (data.email !== undefined) profileData.email = data.email;
      if (data.status !== undefined) profileData.status = data.status;
      if (data.platform_banned !== undefined) profileData.platform_banned = data.platform_banned;
      if (data.ban_reason !== undefined) profileData.ban_reason = data.ban_reason;
      if (data.banned_at !== undefined) profileData.banned_at = data.banned_at;
      if (data.force_password_reset !== undefined) profileData.force_password_reset = data.force_password_reset;
      if (data.last_access !== undefined) profileData.last_access = data.last_access;

      if (Object.keys(profileData).length > 0) {
        const { error } = await client.from("profiles").update(profileData).eq("user_id", id);
        if (error) throwSupabase("profiles", error);
      }
      return getUserByIdInternal(id);
    },
    delete: async (id: string) => {
      const client = getSupabaseAdminClient();
      const { error: profileError } = await client.from("profiles").delete().eq("user_id", id);
      if (profileError) throwSupabase("profiles", profileError);
      const { error } = await client.auth.admin.deleteUser(id);
      if (error) throwSupabase("auth.users", error);
    },
  },

  costLog: {
    create: (data: Omit<ProviderCostLogEntity, "id" | "date_created">) =>
      createRow<ProviderCostLogEntity>(costLogConfig, data),
    getMany: (query?: DirectusQuery) => runQuery<ProviderCostLogEntity>(costLogConfig, query),
    getTotals: (filters?: {
      provider?: string;
      model?: string;
      workspace?: string;
      dateFrom?: string;
      dateTo?: string;
    }) => {
      const filter: Record<string, unknown> = {};
      if (filters?.provider) filter.provider = { _eq: filters.provider };
      if (filters?.model) filter.model = { _eq: filters.model };
      if (filters?.workspace) filter.workspace = { _eq: filters.workspace };
      if (filters?.dateFrom) filter.date_created = { _gte: filters.dateFrom };
      if (filters?.dateTo) {
        filter.date_created = { ...(filter.date_created as Record<string, unknown>), _lte: filters.dateTo };
      }
      return runQuery<ProviderCostLogEntity>(costLogConfig, {
        filter,
        fields: ["input_cost", "output_cost", "total_cost"],
        limit: -1,
      });
    },
  },
};

async function getUserByIdInternal(id: string): Promise<PlatformUserEntity | null> {
  const rows = await queryUsers({ filter: { id: { _eq: id } } });
  return rows[0] ?? null;
}