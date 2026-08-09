"use server";

import { getAuthContext } from "@/lib/auth/auth-context";
import { analyticsQuerySchema, agentAnalyticsSchema } from "@/lib/auth/schemas/analytics.schema";

async function requireAuth() {
  const { isAuthenticated, user } = await getAuthContext();
  if (!isAuthenticated || !user) {
    throw new Error("Unauthorized: You must be logged in.");
  }
  return user;
}

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
  await requireAuth();

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
  await requireAuth();

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
    console.error("Failed to fetch agent analytics:", error);
    return { error: "Failed to load analytics." };
  }
}
