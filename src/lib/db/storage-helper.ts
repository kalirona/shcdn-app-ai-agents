import type { AgentEntity } from "@/lib/db/entities";

const STORAGE_KEY = "agent_ai_local_data";

interface LocalData {
  agents: AgentEntity[];
  workspaces: unknown[];
  memberships: unknown[];
  knowledgeSources: unknown[];
}

function getLocalData(): LocalData {
  if (typeof window === "undefined") {
    return { agents: [], workspaces: [], memberships: [], knowledgeSources: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { agents: [], workspaces: [], memberships: [], knowledgeSources: [] };
}

export function getAgentFromStorage(agentId: string): AgentEntity | null {
  const data = getLocalData();
  return data.agents.find((a) => a.id === agentId) ?? null;
}

export function getAgentsFromStorage(): AgentEntity[] {
  return getLocalData().agents;
}

export function saveAgentToStorage(agent: AgentEntity): void {
  if (typeof window === "undefined") return;
  const data = getLocalData();
  const idx = data.agents.findIndex((a) => a.id === agent.id);
  if (idx >= 0) {
    data.agents[idx] = agent;
  } else {
    data.agents.push(agent);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function deleteAgentFromStorage(agentId: string): void {
  if (typeof window === "undefined") return;
  const data = getLocalData();
  data.agents = data.agents.filter((a) => a.id !== agentId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
