import type { UsageMetric } from "@/lib/auth/schemas/billing.schema";

import { db } from "../client";

export type UsageSnapshot = Record<UsageMetric, number>;

export async function getWorkspaceUsage(workspaceId: string): Promise<UsageSnapshot> {
  const [agents, conversations, bookings, memberships, knowledgeSources] = await Promise.all([
    db.agent.getByWorkspace(workspaceId),
    db.conversation.getByWorkspace(workspaceId),
    db.booking.getByWorkspace(workspaceId),
    db.membership.getByWorkspace(workspaceId),
    db.knowledgeSource.getByWorkspace(workspaceId),
  ]);

  const conversationIds = conversations.map((c) => c.id);
  const messages = conversationIds.length > 0 ? await db.message.getByConversations(conversationIds) : [];

  const activeMembers = memberships.filter((m) => m.status === "active" || m.status === "invited").length;

  let totalTokens = 0;
  for (const message of messages) {
    totalTokens += Math.ceil((message.content?.length ?? 0) / 4);
  }

  return {
    ai_messages: messages.filter((m) => m.role === "assistant").length,
    ai_tokens: totalTokens,
    conversations: conversations.length,
    agents: agents.length,
    knowledge_storage: Math.ceil(knowledgeSources.reduce((sum, s) => sum + (s.chunk_count ?? 0), 0) / 1024),
    documents: knowledgeSources.length,
    team_members: activeMembers,
    bookings: bookings.length,
  };
}
