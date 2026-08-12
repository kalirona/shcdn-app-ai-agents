"use server";

import { revalidatePath } from "next/cache";

import type { z } from "zod";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { PERMISSIONS } from "@/lib/auth/roles";
import { createAgentSchema, updateAgentSchema } from "@/lib/auth/schemas/agent.schema";
import { enforceAgentLimit } from "@/lib/billing/usage-enforcement";

const isLocalDev = process.env.NODE_ENV === "development" && !process.env.DIRECTUS_URL;

export async function createAgent(workspaceId: string, data: z.infer<typeof createAgentSchema>) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.AGENTS_CREATE);
  const parsed = createAgentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const limitCheck = await enforceAgentLimit(workspaceId);
    if (!limitCheck.allowed) {
      return { error: limitCheck.error ?? "Agent limit reached." };
    }

    let agent: { id: string; workspace: string } | null;

    if (isLocalDev) {
      const { localDb } = await import("@/lib/db/local-storage");
      agent = localDb.agent.create({
        workspace: workspaceId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        avatar: null,
        system_prompt: parsed.data.systemInstructions || defaultSystemPrompt(parsed.data.name, parsed.data.tone),
        tone: parsed.data.tone,
        language: parsed.data.language,
        greeting: parsed.data.greeting,
        fallback_message: parsed.data.fallbackMessage,
        purpose: parsed.data.purpose,
        primary_goal: parsed.data.primaryGoal,
        secondary_goal: parsed.data.secondaryGoal,
        fallback_action: parsed.data.fallbackAction,
        behaviors: parsed.data.behaviors,
        allowed_tools: parsed.data.allowedTools,
      });
    } else {
      const agentRepo = await import("@/lib/db/repositories/agent.repo");
      agent = await agentRepo.createAgent({
        workspace: workspaceId,
        name: parsed.data.name,
        description: parsed.data.description || undefined,
        tone: parsed.data.tone,
        greeting: parsed.data.greeting,
        fallbackMessage: parsed.data.fallbackMessage,
        language: parsed.data.language,
        systemPrompt: parsed.data.systemInstructions || defaultSystemPrompt(parsed.data.name, parsed.data.tone),
        purpose: parsed.data.purpose,
        primaryGoal: parsed.data.primaryGoal,
        secondaryGoal: parsed.data.secondaryGoal,
        fallbackAction: parsed.data.fallbackAction,
      });
    }

    revalidatePath("/dashboard/agents");
    return { success: true, agent };
  } catch (error) {
    console.error("Failed to create agent:", error);
    return { error: "Failed to create agent. Please try again." };
  }
}

export async function updateAgent(agentId: string, data: z.infer<typeof updateAgentSchema>) {
  const parsed = updateAgentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const agentRepo = await import("@/lib/db/repositories/agent.repo");
    const existing = isLocalDev ? null : await agentRepo.getAgentById(agentId);
    if (existing) {
      await requireWorkspaceAccess(existing.workspace, PERMISSIONS.AGENTS_UPDATE);
    }

    if (isLocalDev) {
      const { localDb } = await import("@/lib/db/local-storage");
      await localDb.agent.update(agentId, {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        tone: parsed.data.tone,
        greeting: parsed.data.greeting ?? undefined,
        fallback_message: parsed.data.fallbackMessage ?? undefined,
        language: parsed.data.language ?? undefined,
        system_prompt: parsed.data.systemInstructions ?? undefined,
        status: parsed.data.status,
      });
    } else {
      await agentRepo.updateAgent(agentId, {
        name: parsed.data.name,
        description: parsed.data.description,
        tone: parsed.data.tone,
        greeting: parsed.data.greeting,
        fallback_message: parsed.data.fallbackMessage,
        language: parsed.data.language,
        system_prompt: parsed.data.systemInstructions,
        status: parsed.data.status,
      });
    }

    revalidatePath("/dashboard/agents");
    revalidatePath(`/dashboard/agents/${agentId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update agent:", error);
    return { error: "Failed to update agent. Please try again." };
  }
}

export async function deleteAgent(agentId: string) {
  try {
    const agentRepo = await import("@/lib/db/repositories/agent.repo");
    const existing = isLocalDev ? null : await agentRepo.getAgentById(agentId);
    if (existing) {
      await requireWorkspaceAccess(existing.workspace, PERMISSIONS.AGENTS_DELETE);
    }

    if (isLocalDev) {
      const { localDb } = await import("@/lib/db/local-storage");
      await localDb.agent.delete(agentId);
    } else {
      const agentRepo = await import("@/lib/db/repositories/agent.repo");
      await agentRepo.deleteAgent(agentId);
    }

    revalidatePath("/dashboard/agents");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete agent:", error);
    return { error: "Failed to delete agent. Please try again." };
  }
}

export async function getWorkspaceAgents(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.AGENTS_READ);

  try {
    let agents: { id: string; workspace: string }[];

    if (isLocalDev) {
      const { localDb } = await import("@/lib/db/local-storage");
      agents = localDb.agent.getByWorkspace(workspaceId);
    } else {
      const agentRepo = await import("@/lib/db/repositories/agent.repo");
      agents = await agentRepo.getWorkspaceAgents(workspaceId);
    }

    return { success: true, agents };
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    return { error: "Failed to load agents.", agents: [] };
  }
}

export async function getAgentById(agentId: string) {
  try {
    const agentRepo = await import("@/lib/db/repositories/agent.repo");
    const agent = isLocalDev
      ? (await import("@/lib/db/local-storage")).localDb.agent.getById(agentId)
      : await agentRepo.getAgentById(agentId);

    if (agent) {
      await requireWorkspaceAccess(agent.workspace, PERMISSIONS.AGENTS_READ);
    }

    if (!agent) {
      return { error: "Agent not found.", agent: null };
    }
    return { success: true, agent };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message, agent: null };
    }
    console.error("Failed to fetch agent:", error);
    return { error: "Failed to load agent.", agent: null };
  }
}

function defaultSystemPrompt(name: string, tone: string): string {
  const toneMap: Record<string, string> = {
    professional: "You are a professional and courteous assistant.",
    friendly: "You are a warm and friendly assistant who makes everyone feel welcome.",
    casual: "You are a casual and relaxed assistant.",
    custom: "You are a helpful assistant.",
  };

  return `${toneMap[tone] ?? toneMap.professional}

Your name is ${name}. You help customers by answering questions about the business.

Rules:
- Always be helpful and concise.
- If you don't know the answer, say so honestly and offer to connect them with a human.
- Never make up information or policies.
- If a customer seems frustrated or asks for a human, offer to escalate.
- Keep responses under 3 sentences unless more detail is needed.`;
}
