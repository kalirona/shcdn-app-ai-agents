"use server";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { PERMISSIONS } from "@/lib/auth/roles";
import {
  getAgentAnalyticsData,
  getTopQuestions,
  getUnansweredQuestions,
  getWorkspaceAnalyticsKPIs,
} from "@/lib/db/repositories/analytics.repo";

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

export async function getWorkspaceAnalytics(workspaceId: string, period: "today" | "7d" | "30d" | "90d" = "30d") {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.ANALYTICS_READ);

  try {
    const [kpis, topQuestions, unansweredQuestions] = await Promise.all([
      getWorkspaceAnalyticsKPIs(workspaceId, period),
      getTopQuestions(workspaceId, period),
      getUnansweredQuestions(workspaceId, period),
    ]);

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
    const analytics = await getAgentAnalyticsData(agentId);
    if (!analytics) {
      return { error: "Agent not found." };
    }

    return {
      success: true,
      analytics,
    };
  } catch (error) {
    console.error("Failed to fetch agent analytics:", error);
    return { error: "Failed to load analytics." };
  }
}
