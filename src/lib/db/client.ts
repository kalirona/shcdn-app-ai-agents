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

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? "";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN ?? "";

interface DirectusResponse<T> {
  data: T;
}

interface DirectusQuery {
  filter?: Record<string, unknown>;
  fields?: string[];
  sort?: string[];
  limit?: number;
  offset?: number;
  page?: number;
}

async function request<T>(path: string, options: RequestInit = {}, query?: DirectusQuery): Promise<T> {
  const url = new URL(`${DIRECTUS_URL}/items/${path}`);

  if (query?.filter) {
    url.searchParams.set("filter", JSON.stringify(query.filter));
  }
  if (query?.fields) {
    url.searchParams.set("fields", query.fields.join(","));
  }
  if (query?.sort) {
    url.searchParams.set("sort", query.sort.join(","));
  }
  if (query?.limit) {
    url.searchParams.set("limit", String(query.limit));
  }
  if (query?.offset) {
    url.searchParams.set("offset", String(query.offset));
  }
  if (query?.page) {
    url.searchParams.set("page", String(query.page));
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Directus error [${response.status}]: ${errorBody}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data: DirectusResponse<T> = text ? JSON.parse(text) : (undefined as T);
  return data.data;
}

/**
 * Directus /users endpoint (system collection, not under /items).
 */
async function requestUsers<T>(path: string, options: RequestInit = {}, query?: DirectusQuery): Promise<T> {
  const url = new URL(`${DIRECTUS_URL}/users/${path}`);

  if (query?.filter) {
    url.searchParams.set("filter", JSON.stringify(query.filter));
  }
  if (query?.fields) {
    url.searchParams.set("fields", query.fields.join(","));
  }
  if (query?.sort) {
    url.searchParams.set("sort", query.sort.join(","));
  }
  if (query?.limit) {
    url.searchParams.set("limit", String(query.limit));
  }
  if (query?.offset) {
    url.searchParams.set("offset", String(query.offset));
  }
  if (query?.page) {
    url.searchParams.set("page", String(query.page));
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Directus error [${response.status}]: ${errorBody}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data: DirectusResponse<T> = text ? JSON.parse(text) : (undefined as T);
  return data.data;
}

export const db = {
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
    ) =>
      request<WorkspaceEntity>("/workspaces", {
        method: "POST",
        body: JSON.stringify({ ...data, status: "active" }),
      }),

    getById: (id: string) => request<WorkspaceEntity>(`/workspaces/${id}`),

    getMany: (query?: DirectusQuery) => request<WorkspaceEntity[]>("/workspaces", {}, query),

    update: (id: string, data: Partial<WorkspaceEntity>) =>
      request<WorkspaceEntity>(`/workspaces/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => request<void>(`/workspaces/${id}`, { method: "DELETE" }),
  },

  membership: {
    create: (
      data: Omit<MembershipEntity, "id" | "date_created" | "date_updated" | "status"> & {
        status?: "active" | "invited" | "inactive";
      },
    ) =>
      request<MembershipEntity>("/memberships", {
        method: "POST",
        body: JSON.stringify({ ...data, status: data.status ?? "active" }),
      }),

    getById: (id: string) => request<MembershipEntity>(`/memberships/${id}`),

    getMany: (query?: DirectusQuery) => request<MembershipEntity[]>("/memberships", {}, query),

    getByWorkspace: (workspaceId: string) =>
      request<MembershipEntity[]>(
        "/memberships",
        {},
        {
          filter: { workspace: { _eq: workspaceId } },
          sort: ["-role", "date_created"],
        },
      ),

    getByUser: (userId: string) =>
      request<MembershipEntity[]>(
        "/memberships",
        {},
        {
          filter: { user: { _eq: userId } },
        },
      ),

    update: (id: string, data: Partial<MembershipEntity>) =>
      request<MembershipEntity>(`/memberships/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => request<void>(`/memberships/${id}`, { method: "DELETE" }),
  },

  agent: {
    create: (data: Omit<AgentEntity, "id" | "date_created" | "date_updated" | "status">) =>
      request<AgentEntity>("/agents", {
        method: "POST",
        body: JSON.stringify({ ...data, status: "active" }),
      }),

    getById: (id: string) => request<AgentEntity>(`/agents/${id}`),

    getMany: (query?: DirectusQuery) => request<AgentEntity[]>("/agents", {}, query),

    getByWorkspace: (workspaceId: string) =>
      request<AgentEntity[]>(
        "/agents",
        {},
        {
          filter: { workspace: { _eq: workspaceId } },
          sort: ["-date_created"],
        },
      ),

    update: (id: string, data: Partial<AgentEntity>) =>
      request<AgentEntity>(`/agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => request<void>(`/agents/${id}`, { method: "DELETE" }),
  },

  knowledgeSource: {
    create: (data: Omit<KnowledgeSourceEntity, "id" | "date_created" | "date_updated" | "status" | "chunk_count">) =>
      request<KnowledgeSourceEntity>("/knowledge_sources", {
        method: "POST",
        body: JSON.stringify({ ...data, status: "pending", chunk_count: 0 }),
      }),

    getById: (id: string) => request<KnowledgeSourceEntity>(`/knowledge_sources/${id}`),

    getByAgent: (agentId: string) =>
      request<KnowledgeSourceEntity[]>(
        "/knowledge_sources",
        {},
        {
          filter: { agent: { _eq: agentId } },
          sort: ["-date_created"],
        },
      ),

    getByWorkspace: (workspaceId: string) =>
      request<KnowledgeSourceEntity[]>(
        "/knowledge_sources",
        {},
        {
          filter: { workspace: { _eq: workspaceId } },
          sort: ["-date_created"],
        },
      ),

    update: (id: string, data: Partial<KnowledgeSourceEntity>) =>
      request<KnowledgeSourceEntity>(`/knowledge_sources/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => request<void>(`/knowledge_sources/${id}`, { method: "DELETE" }),
  },

  knowledgeChunk: {
    create: (data: Omit<KnowledgeChunkEntity, "id">) =>
      request<KnowledgeChunkEntity>("/knowledge_chunks", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getBySource: (sourceId: string) =>
      request<KnowledgeChunkEntity[]>(
        "/knowledge_chunks",
        {},
        {
          filter: { source: { _eq: sourceId } },
          sort: ["index"],
        },
      ),

    getMany: (query?: DirectusQuery) => request<KnowledgeChunkEntity[]>("/knowledge_chunks", {}, query),

    update: (id: string, data: Partial<KnowledgeChunkEntity>) =>
      request<KnowledgeChunkEntity>(`/knowledge_chunks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    deleteBySource: async (sourceId: string) => {
      const chunks = await request<{ id: string }[]>(
        "/knowledge_chunks",
        {},
        {
          fields: ["id"],
          filter: { source: { _eq: sourceId } },
        },
      );
      await Promise.all(chunks.map((chunk) => request<void>(`/knowledge_chunks/${chunk.id}`, { method: "DELETE" })));
    },
  },

  calendarIntegration: {
    create: (data: Omit<CalendarIntegrationEntity, "id" | "date_created" | "date_updated" | "status">) =>
      request<CalendarIntegrationEntity>("/calendar_integrations", {
        method: "POST",
        body: JSON.stringify({ ...data, status: "disconnected" }),
      }),

    getById: (id: string) => request<CalendarIntegrationEntity>(`/calendar_integrations/${id}`),

    getByWorkspace: (workspaceId: string) =>
      request<CalendarIntegrationEntity[]>(
        "/calendar_integrations",
        {},
        {
          filter: { workspace: { _eq: workspaceId } },
          sort: ["-date_created"],
        },
      ),

    update: (id: string, data: Partial<CalendarIntegrationEntity>) =>
      request<CalendarIntegrationEntity>(`/calendar_integrations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => request<void>(`/calendar_integrations/${id}`, { method: "DELETE" }),
  },

  conversation: {
    create: (data: Omit<ConversationEntity, "id" | "date_created" | "date_updated" | "status">) =>
      request<ConversationEntity>("/conversations", {
        method: "POST",
        body: JSON.stringify({ ...data, status: "active" }),
      }),

    getById: (id: string) => request<ConversationEntity>(`/conversations/${id}`),

    getBySession: (sessionId: string) =>
      request<ConversationEntity[]>(
        "/conversations",
        {},
        {
          filter: { customer: { _eq: sessionId } },
          limit: 1,
          sort: ["-date_created"],
        },
      ),

    getMany: (query?: DirectusQuery) => request<ConversationEntity[]>("/conversations", {}, query),

    getByWorkspace: (workspaceId: string, status?: string) =>
      request<ConversationEntity[]>(
        "/conversations",
        {},
        {
          filter: {
            workspace: { _eq: workspaceId },
            ...(status ? { status: { _eq: status } } : {}),
          },
          sort: ["-date_created"],
        },
      ),

    getByAgent: (agentId: string) =>
      request<ConversationEntity[]>(
        "/conversations",
        {},
        {
          filter: { agent: { _eq: agentId } },
          sort: ["-date_created"],
        },
      ),

    update: (id: string, data: Partial<ConversationEntity>) =>
      request<ConversationEntity>(`/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => request<void>(`/conversations/${id}`, { method: "DELETE" }),
  },

  message: {
    create: (data: Omit<MessageEntity, "id" | "date_created">) =>
      request<MessageEntity>("/messages", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getByConversation: (conversationId: string) =>
      request<MessageEntity[]>(
        "/messages",
        {},
        {
          filter: { conversation: { _eq: conversationId } },
          sort: ["date_created"],
        },
      ),

    getByConversations: (conversationIds: string[]) =>
      request<MessageEntity[]>(
        "/messages",
        {},
        {
          filter: { conversation: { _in: conversationIds } },
          sort: ["date_created"],
        },
      ),

    getByWorkspace: (workspaceId: string) =>
      request<MessageEntity[]>(
        "/messages",
        {},
        {
          filter: { workspace: { _eq: workspaceId } },
          sort: ["-date_created"],
        },
      ),

    getByAgent: (agentId: string) =>
      request<MessageEntity[]>(
        "/messages",
        {},
        {
          filter: { agent: { _eq: agentId } },
          sort: ["-date_created"],
        },
      ),

    delete: (id: string) => request<void>(`/messages/${id}`, { method: "DELETE" }),
  },

  lead: {
    create: (data: Omit<LeadEntity, "id" | "date_created" | "date_updated">) =>
      request<LeadEntity>("/leads", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getById: (id: string) => request<LeadEntity>(`/leads/${id}`),

    getByWorkspace: (workspaceId: string) =>
      request<LeadEntity[]>(
        "/leads",
        {},
        {
          filter: { workspace: { _eq: workspaceId } },
          sort: ["-date_created"],
        },
      ),

    update: (id: string, data: Partial<LeadEntity>) =>
      request<LeadEntity>(`/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => request<void>(`/leads/${id}`, { method: "DELETE" }),
  },

  booking: {
    create: (data: Omit<BookingEntity, "id" | "date_created" | "date_updated">) =>
      request<BookingEntity>("/bookings", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getById: (id: string) => request<BookingEntity>(`/bookings/${id}`),

    getByWorkspace: (workspaceId: string) =>
      request<BookingEntity[]>(
        "/bookings",
        {},
        {
          filter: { workspace: { _eq: workspaceId } },
          sort: ["-date_created"],
        },
      ),

    update: (id: string, data: Partial<BookingEntity>) =>
      request<BookingEntity>(`/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => request<void>(`/bookings/${id}`, { method: "DELETE" }),
  },

  customer: {
    create: (data: Omit<CustomerEntity, "id" | "date_created" | "date_updated">) =>
      request<CustomerEntity>("/customers", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getById: (id: string) => request<CustomerEntity>(`/customers/${id}`),

    getByWorkspace: (workspaceId: string) =>
      request<CustomerEntity[]>(
        "/customers",
        {},
        {
          filter: { workspace: { _eq: workspaceId } },
          sort: ["-date_created"],
        },
      ),

    update: (id: string, data: Partial<CustomerEntity>) =>
      request<CustomerEntity>(`/customers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => request<void>(`/customers/${id}`, { method: "DELETE" }),
  },

  webhook: {
    create: (data: Omit<WebhookEntity, "id" | "date_created" | "date_updated" | "active"> & { active?: boolean }) =>
      request<WebhookEntity>("/webhooks", {
        method: "POST",
        body: JSON.stringify({ ...data, active: data.active ?? true }),
      }),

    getById: (id: string) => request<WebhookEntity>(`/webhooks/${id}`),

    getMany: (query?: DirectusQuery) => request<WebhookEntity[]>("/webhooks", {}, query),

    getByWorkspace: (workspaceId: string) =>
      request<WebhookEntity[]>(
        "/webhooks",
        {},
        {
          filter: { workspace: { _eq: workspaceId } },
          sort: ["-date_created"],
        },
      ),

    update: (id: string, data: Partial<WebhookEntity>) =>
      request<WebhookEntity>(`/webhooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => request<void>(`/webhooks/${id}`, { method: "DELETE" }),
  },

  webhookDelivery: {
    create: (data: Omit<WebhookDeliveryEntity, "id" | "date_created" | "date_updated">) =>
      request<WebhookDeliveryEntity>("/webhook_deliveries", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getByWebhook: (webhookId: string) =>
      request<WebhookDeliveryEntity[]>(
        "/webhook_deliveries",
        {},
        {
          filter: { webhook: { _eq: webhookId } },
          sort: ["-date_created"],
        },
      ),

    getMany: (query?: DirectusQuery) => request<WebhookDeliveryEntity[]>("/webhook_deliveries", {}, query),
  },

  webhookEvent: {
    create: (data: Omit<WebhookEventEntity, "id" | "date_created" | "date_updated">) =>
      request<WebhookEventEntity>("/webhook_events", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getByEventId: (provider: string, eventId: string) =>
      request<WebhookEventEntity[]>(
        "/webhook_events",
        {},
        {
          filter: { provider: { _eq: provider }, event_id: { _eq: eventId } },
          limit: 1,
        },
      ),

    getMany: (query?: DirectusQuery) => request<WebhookEventEntity[]>("/webhook_events", {}, query),
  },

  platformRole: {
    create: (
      data: Omit<PlatformRoleEntity, "id" | "date_created" | "date_updated" | "status"> & {
        status?: "active" | "inactive";
      },
    ) =>
      request<PlatformRoleEntity>("/platform_roles", {
        method: "POST",
        body: JSON.stringify({ ...data, status: data.status ?? "active" }),
      }),

    getById: (id: string) => request<PlatformRoleEntity>(`/platform_roles/${id}`),

    getMany: (query?: DirectusQuery) => request<PlatformRoleEntity[]>("/platform_roles", {}, query),

    getByUser: (userId: string) =>
      request<PlatformRoleEntity[]>(
        "/platform_roles",
        {},
        {
          filter: { user: { _eq: userId } },
        },
      ),

    update: (id: string, data: Partial<PlatformRoleEntity>) =>
      request<PlatformRoleEntity>(`/platform_roles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => request<void>(`/platform_roles/${id}`, { method: "DELETE" }),
  },

  platformSettings: {
    get: () => request<PlatformSettingsEntity>("/platform_settings"),

    update: (data: Partial<PlatformSettingsEntity>) =>
      request<PlatformSettingsEntity>("/platform_settings", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  aiProvider: {
    create: (
      data: Omit<
        AIProviderEntity,
        "id" | "date_created" | "date_updated" | "status" | "last_tested_at" | "last_error"
      > & {
        status?: AIProviderEntity["status"];
        last_tested_at?: string | null;
        last_error?: string | null;
      },
    ) =>
      request<AIProviderEntity>("/ai_providers", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          status: data.status ?? "untested",
          last_tested_at: data.last_tested_at ?? null,
          last_error: data.last_error ?? null,
        }),
      }),

    getById: (id: string) => request<AIProviderEntity>(`/ai_providers/${id}`),

    getMany: (query?: DirectusQuery) => request<AIProviderEntity[]>("/ai_providers", {}, query),

    getByKey: (providerKey: string) =>
      request<AIProviderEntity[]>(
        "/ai_providers",
        {},
        {
          filter: { provider_key: { _eq: providerKey } },
          limit: 1,
        },
      ),

    update: (id: string, data: Partial<AIProviderEntity>) =>
      request<AIProviderEntity>(`/ai_providers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => request<void>(`/ai_providers/${id}`, { method: "DELETE" }),
  },

  aiModel: {
    create: (
      data: Omit<AIModelEntity, "id" | "date_created" | "date_updated"> & {
        source?: AIModelEntity["source"];
      },
    ) =>
      request<AIModelEntity>("/ai_models", {
        method: "POST",
        body: JSON.stringify({ ...data, source: data.source ?? "discovered" }),
      }),

    getById: (id: string) => request<AIModelEntity>(`/ai_models/${id}`),

    getMany: (query?: DirectusQuery) => request<AIModelEntity[]>("/ai_models", {}, query),

    getByProvider: (providerId: string) =>
      request<AIModelEntity[]>(
        "/ai_models",
        {},
        {
          filter: { provider: { _eq: providerId } },
          sort: ["model_id"],
        },
      ),

    update: (id: string, data: Partial<AIModelEntity>) =>
      request<AIModelEntity>(`/ai_models/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => request<void>(`/ai_models/${id}`, { method: "DELETE" }),
  },

  aiDefaults: {
    get: () => request<AIDefaultsEntity>("/ai_defaults"),

    update: (data: Partial<AIDefaultsEntity>) =>
      request<AIDefaultsEntity>("/ai_defaults", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  auditLog: {
    create: (data: Omit<AuditLogEntity, "id" | "date_created">) =>
      request<AuditLogEntity>("/platform_audit_logs", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getMany: (query?: DirectusQuery) => request<AuditLogEntity[]>("/platform_audit_logs", {}, query),
  },

  user: {
    getMany: (query?: DirectusQuery) => requestUsers<PlatformUserEntity[]>("", {}, query),

    getById: (id: string) => requestUsers<PlatformUserEntity>(id),

    update: (id: string, data: Partial<PlatformUserEntity>) =>
      requestUsers<PlatformUserEntity>(id, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) => requestUsers<void>(id, { method: "DELETE" }),
  },

  costLog: {
    create: (data: Omit<ProviderCostLogEntity, "id" | "date_created">) =>
      request<ProviderCostLogEntity>("/provider_cost_logs", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getMany: (query?: DirectusQuery) => request<ProviderCostLogEntity[]>("/provider_cost_logs", {}, query),

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
      return request<ProviderCostLogEntity[]>(
        "/provider_cost_logs",
        {},
        { filter, fields: ["input_cost", "output_cost", "total_cost"], limit: -1 },
      );
    },
  },
};
