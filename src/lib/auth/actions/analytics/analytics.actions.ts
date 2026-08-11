"use server";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { PERMISSIONS } from "@/lib/auth/roles";
import { agentAnalyticsSchema, analyticsQuerySchema } from "@/lib/auth/schemas/analytics.schema";

export interface AnalyticsKPIs {
  totalConversations: number;
  aiResolved: number;
  humanHandoffs: number;
  leadsCaptured: number;
  bookingsCreated: number;
  avgResponseTime: string;
  resolutionRate: number;
}

export interface TopQuestion {
  question: string;
  count: number;
}

export interface UnansweredQuestion {
  question: string;
  date: string;
}

export async function getWorkspaceAnalytics(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.ANALYTICS_READ);

  try {
    // TODO: Aggregate from Directus
    const kpis: AnalyticsKPIs = {
      totalConversations: 0,
      aiResolved: 0,
      humanHandoffs: 0,
      leadsCaptured: 0,
      bookingsCreated: 0,
      avgResponseTime: "< 1s",
      resolutionRate: 0,
    };

    const topQuestions: TopQuestion[] = [];
    const unansweredQuestions: UnansweredQuestion[] = [];

    return {
      success: true,
      kpis,
      topQuestions,
      unansweredQuestions,
    };
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return { error: "Failed to load analytics." };
  }
}

export async function getAgentAnalytics(agentId: string) {
  try {
    const agentRepo = await import("@/lib/db/repositories/agent.repo");
    const agent = await agentRepo.getAgentById(agentId);
    if (agent) {
      await requireWorkspaceAccess(agent.workspace, PERMISSIONS.ANALYTICS_READ);
    }

    // TODO: Aggregate from Directus
    const kpis: AnalyticsKPIs = {
      totalConversations: 0,
      aiResolved: 0,
      humanHandoffs: 0,
      leadsCaptured: 0,
      bookingsCreated: 0,
      avgResponseTime: "< 1s",
      resolutionRate: 0,
    };

    const topQuestions: TopQuestion[] = [];
    const unansweredQuestions: UnansweredQuestion[] = [];

    return {
      success: true,
      kpis,
      topQuestions,
      unansweredQuestions,
    };
  } catch (error) {
    console.error("Failed to fetch agent analytics:", error);
    return { error: "Failed to load analytics." };
  }
}
