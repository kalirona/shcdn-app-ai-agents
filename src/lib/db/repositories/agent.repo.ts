import { db } from "../client";
import type { AgentEntity } from "../entities";

export interface CreateAgentParams {
  workspace: string;
  name: string;
  description?: string;
  systemPrompt: string;
  tone?: "professional" | "friendly" | "casual" | "custom";
  language?: string;
  greeting?: string;
  fallbackMessage?: string;
  purpose?: string;
  primaryGoal?: string;
  secondaryGoal?: string;
  fallbackAction?: string;
}

export async function createAgent(params: CreateAgentParams): Promise<AgentEntity> {
  return db.agent.create({
    workspace: params.workspace,
    name: params.name,
    description: params.description ?? null,
    avatar: null,
    system_prompt: params.systemPrompt,
    tone: params.tone ?? "professional",
    language: params.language ?? "en",
    greeting: params.greeting ?? "Hello! How can I help you today?",
    fallback_message:
      params.fallbackMessage ?? "I'm not sure about that. Let me connect you with someone who can help.",
    purpose: params.purpose ?? "custom",
    primary_goal: params.primaryGoal ?? "answer_questions",
    secondary_goal: params.secondaryGoal ?? "",
    fallback_action: params.fallbackAction ?? "transfer_human",
  });
}

export async function getWorkspaceAgents(workspaceId: string): Promise<AgentEntity[]> {
  return db.agent.getByWorkspace(workspaceId);
}

export async function getAgentById(id: string): Promise<AgentEntity | null> {
  try {
    return await db.agent.getById(id);
  } catch {
    return null;
  }
}

export async function updateAgent(
  id: string,
  data: Partial<
    Pick<
      AgentEntity,
      "name" | "description" | "system_prompt" | "tone" | "language" | "greeting" | "fallback_message" | "status"
    >
  >,
): Promise<AgentEntity> {
  return db.agent.update(id, data);
}

export async function deleteAgent(id: string): Promise<void> {
  await db.agent.delete(id);
}
