const isLocalDev = process.env.NODE_ENV === "development" && !process.env.DIRECTUS_URL;

const STORAGE_KEY = "agent_ai_local_data";

interface LocalData {
  agents: AgentEntity[];
  workspaces: WorkspaceEntity[];
  memberships: MembershipEntity[];
  knowledgeSources: KnowledgeSourceEntity[];
}

function getLocalData(): LocalData {
  if (typeof window === "undefined") return { agents: [], workspaces: [], memberships: [], knowledgeSources: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { agents: [], workspaces: [], memberships: [], knowledgeSources: [] };
}

function setLocalData(data: LocalData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const localDb = {
  workspace: {
    create(data: Omit<WorkspaceEntity, "id" | "date_created" | "date_updated" | "status">): WorkspaceEntity {
      const ws: WorkspaceEntity = {
        ...data,
        id: generateId(),
        status: "active",
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
      };
      const localData = getLocalData();
      localData.workspaces.push(ws);
      setLocalData(localData);
      return ws;
    },

    getBySlug(slug: string): WorkspaceEntity | undefined {
      return getLocalData().workspaces.find((w) => w.slug === slug);
    },

    getById(id: string): WorkspaceEntity | undefined {
      return getLocalData().workspaces.find((w) => w.id === id);
    },
  },

  membership: {
    create(data: Omit<MembershipEntity, "id" | "date_created" | "date_updated" | "status">): MembershipEntity {
      const mem: MembershipEntity = {
        ...data,
        id: generateId(),
        status: "active",
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
      };
      const localData = getLocalData();
      localData.memberships.push(mem);
      setLocalData(localData);
      return mem;
    },

    getByUser(userId: string): MembershipEntity[] {
      return getLocalData().memberships.filter((m) => m.user === userId);
    },

    getByWorkspace(workspaceId: string): MembershipEntity[] {
      return getLocalData().memberships.filter((m) => m.workspace === workspaceId);
    },

    delete(id: string): void {
      const localData = getLocalData();
      localData.memberships = localData.memberships.filter((m) => m.id !== id);
      setLocalData(localData);
    },
  },

  agent: {
    create(data: Omit<AgentEntity, "id" | "date_created" | "date_updated" | "status">): AgentEntity {
      const agent: AgentEntity = {
        ...data,
        id: generateId(),
        status: "draft",
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
      };
      const localData = getLocalData();
      localData.agents.push(agent);
      setLocalData(localData);
      return agent;
    },

    getById(id: string): AgentEntity | null {
      return getLocalData().agents.find((a) => a.id === id) ?? null;
    },

    getByWorkspace(workspaceId: string): AgentEntity[] {
      return getLocalData().agents.filter((a) => a.workspace === workspaceId);
    },

    update(id: string, data: Partial<AgentEntity>): AgentEntity | null {
      const localData = getLocalData();
      const idx = localData.agents.findIndex((a) => a.id === id);
      if (idx === -1) return null;
      localData.agents[idx] = { ...localData.agents[idx], ...data, date_updated: new Date().toISOString() };
      setLocalData(localData);
      return localData.agents[idx];
    },

    delete(id: string): void {
      const localData = getLocalData();
      localData.agents = localData.agents.filter((a) => a.id !== id);
      setLocalData(localData);
    },
  },

  knowledge: {
    create(
      data: Omit<KnowledgeSourceEntity, "id" | "date_created" | "date_updated" | "status" | "chunk_count">,
    ): KnowledgeSourceEntity {
      const source: KnowledgeSourceEntity = {
        ...data,
        id: generateId(),
        status: "ready",
        chunk_count: 0,
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
      };
      const localData = getLocalData();
      localData.knowledgeSources.push(source);
      setLocalData(localData);
      return source;
    },

    getByAgent(agentId: string): KnowledgeSourceEntity[] {
      return getLocalData().knowledgeSources.filter((s) => s.agent === agentId);
    },

    getByWorkspace(workspaceId: string): KnowledgeSourceEntity[] {
      return getLocalData().knowledgeSources.filter((s) => s.workspace === workspaceId);
    },

    updateStatus(id: string, status: KnowledgeSourceEntity["status"]): void {
      const localData = getLocalData();
      const source = localData.knowledgeSources.find((s) => s.id === id);
      if (source) {
        source.status = status;
        source.date_updated = new Date().toISOString();
        setLocalData(localData);
      }
    },

    delete(id: string): void {
      const localData = getLocalData();
      localData.knowledgeSources = localData.knowledgeSources.filter((s) => s.id !== id);
      setLocalData(localData);
    },
  },
};

import type { AgentEntity, KnowledgeSourceEntity, MembershipEntity, WorkspaceEntity } from "./entities";
