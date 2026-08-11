"use server";

import { db } from "@/lib/db/client";

export interface PlatformStats {
  totalUsers: number;
  totalWorkspaces: number;
  totalAgents: number;
  totalConversations: number;
  totalRevenue: number;
  activeSubscriptions: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  try {
    const [workspaces, memberships, agents, conversations] = await Promise.all([
      db.workspace.getMany({ fields: ["id", "plan", "subscription_status"] }),
      db.membership.getMany({ fields: ["user"] }),
      db.agent.getMany({ fields: ["id"] }),
      db.conversation.getMany({ fields: ["id"] }),
    ]);

    const totalUsers = new Set(memberships.map((m) => m.user).filter(Boolean)).size;
    const activeSubscriptions = workspaces.filter(
      (w) => w.subscription_status === "active" || w.subscription_status === "trialing",
    ).length;

    const planPrices: Record<string, number> = { starter: 29, business: 79, pro: 149 };
    const totalRevenue = workspaces.reduce((sum, w) => {
      if (w.subscription_status === "active" || w.subscription_status === "trialing") {
        return sum + (planPrices[w.plan] ?? 0);
      }
      return sum;
    }, 0);

    return {
      totalUsers,
      totalWorkspaces: workspaces.length,
      totalAgents: agents.length,
      totalConversations: conversations.length,
      totalRevenue,
      activeSubscriptions,
    };
  } catch (error) {
    console.error("Failed to fetch platform stats:", error);
    return {
      totalUsers: 0,
      totalWorkspaces: 0,
      totalAgents: 0,
      totalConversations: 0,
      totalRevenue: 0,
      activeSubscriptions: 0,
    };
  }
}
