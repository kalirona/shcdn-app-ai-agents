import type {
  AgentEntity,
  ConversationEntity,
  KnowledgeChunkEntity,
  KnowledgeSourceEntity,
  MembershipEntity,
  MessageEntity,
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

  const data: DirectusResponse<T> = await response.json();
  return data.data;
}

export const db = {
  workspace: {
    create: (data: Omit<WorkspaceEntity, "id" | "date_created" | "date_updated" | "status">) =>
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
    create: (data: Omit<MembershipEntity, "id" | "date_created" | "date_updated" | "status">) =>
      request<MembershipEntity>("/memberships", {
        method: "POST",
        body: JSON.stringify({ ...data, status: "active" }),
      }),

    getById: (id: string) => request<MembershipEntity>(`/memberships/${id}`),

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
        body: JSON.stringify({ ...data, status: "draft" }),
      }),

    getById: (id: string) => request<AgentEntity>(`/agents/${id}`),

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

  conversation: {
    create: (data: Omit<ConversationEntity, "id" | "date_created" | "date_updated" | "status">) =>
      request<ConversationEntity>("/conversations", {
        method: "POST",
        body: JSON.stringify({ ...data, status: "active" }),
      }),

    getById: (id: string) => request<ConversationEntity>(`/conversations/${id}`),

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

    delete: (id: string) => request<void>(`/messages/${id}`, { method: "DELETE" }),
  },
};
