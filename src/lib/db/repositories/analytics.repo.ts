import { db } from "../client";
import type {
  AgentEntity,
  BookingEntity,
  ConversationEntity,
  CustomerEntity,
  KnowledgeSourceEntity,
  LeadEntity,
  MessageEntity,
} from "../entities";

export interface TimeRange {
  from: string;
  to: string;
}

export function getTimeRange(period: "today" | "7d" | "30d" | "90d"): TimeRange {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  switch (period) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "7d":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
  }

  return { from: from.toISOString(), to };
}

export interface WorkspaceAnalyticsKPIs {
  totalConversations: number;
  newConversations: number;
  aiResolved: number;
  humanHandoffs: number;
  resolutionRate: number | null;
  totalMessages: number;
  avgResponseTimeMs: number | null;
  leadsCaptured: number;
  bookingsCreated: number;
  customersAcquired: number;
  knowledgeSources: number;
  activeAgents: number;
}

export async function getWorkspaceAnalyticsKPIs(
  workspaceId: string,
  period: "today" | "7d" | "30d" | "90d" = "30d",
): Promise<WorkspaceAnalyticsKPIs> {
  const { from, to } = getTimeRange(period);

  const [conversations, messages, leads, bookings, customers, agents, knowledgeSrc] = await Promise.all([
    db.conversation.getByWorkspace(workspaceId),
    db.message.getByWorkspace(workspaceId),
    db.lead.getByWorkspace(workspaceId),
    db.booking.getByWorkspace(workspaceId),
    db.customer.getByWorkspace(workspaceId),
    db.agent.getByWorkspace(workspaceId),
    db.knowledgeSource.getByWorkspace(workspaceId),
  ]);

  // Filter by time range
  const inRange = (dateStr: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= new Date(from) && d <= new Date(to);
  };

  const conversationsInRange = conversations.filter((c) => inRange(c.date_created));
  const messagesInRange = messages.filter((m) => inRange(m.date_created));
  const leadsInRange = leads.filter((l) => inRange(l.date_created));
  const bookingsInRange = bookings.filter((b) => inRange(b.date_created));
  const customersInRange = customers.filter((c) => inRange(c.date_created));

  // Conversation metrics
  const totalConversations = conversations.length;
  const newConversations = conversationsInRange.length;
  const aiResolved = conversations.filter((c) => c.status === "resolved").length;
  const humanHandoffs = conversations.filter((c) => c.status === "with_human" || c.status === "human_required").length;

  // Resolution rate: only calculate if we have resolved + handoff conversations
  const closedConversations = aiResolved + humanHandoffs;
  const resolutionRate = closedConversations > 0 ? (aiResolved / closedConversations) * 100 : null;

  // Message metrics
  const totalMessages = messagesInRange.length;

  // Average response time: time between user message and next assistant message
  let avgResponseTimeMs: number | null = null;
  if (messagesInRange.length > 0) {
    const conversationMessages = new Map<string, MessageEntity[]>();
    for (const msg of messagesInRange) {
      if (!conversationMessages.has(msg.conversation)) {
        conversationMessages.set(msg.conversation, []);
      }
      conversationMessages.get(msg.conversation)!.push(msg);
    }

    const responseTimes: number[] = [];
    for (const [, msgs] of conversationMessages) {
      const sorted = [...msgs].sort((a, b) => new Date(a.date_created).getTime() - new Date(b.date_created).getTime());
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].role === "user" && sorted[i + 1].role === "assistant") {
          const t1 = new Date(sorted[i].date_created).getTime();
          const t2 = new Date(sorted[i + 1].date_created).getTime();
          responseTimes.push(t2 - t1);
        }
      }
    }
    if (responseTimes.length > 0) {
      avgResponseTimeMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }
  }

  // Lead metrics
  const leadsCaptured = leadsInRange.length;

  // Booking metrics
  const bookingsCreated = bookingsInRange.length;

  // Customer metrics
  const customersAcquired = customersInRange.length;

  // Knowledge sources
  const knowledgeSources = knowledgeSrc.length;

  // Active agents (status = active)
  const activeAgents = agents.filter((a) => a.status === "active").length;

  return {
    totalConversations,
    newConversations,
    aiResolved,
    humanHandoffs,
    resolutionRate,
    totalMessages,
    avgResponseTimeMs,
    leadsCaptured,
    bookingsCreated,
    customersAcquired,
    knowledgeSources,
    activeAgents,
  };
}

export interface TopQuestion {
  question: string;
  count: number;
}

export async function getTopQuestions(
  workspaceId: string,
  period: "today" | "7d" | "30d" | "90d" = "30d",
  limit = 10,
): Promise<TopQuestion[]> {
  const { from, to } = getTimeRange(period);
  const messages = await db.message.getByWorkspace(workspaceId);

  const inRange = messages.filter((m) => {
    const d = new Date(m.date_created);
    return d >= new Date(from) && d <= new Date(to);
  });

  const userMessages = inRange.filter((m) => m.role === "user");

  // Simple frequency count of user questions (first 100 chars)
  const questionCounts = new Map<string, number>();
  for (const msg of userMessages) {
    const key = msg.content.slice(0, 100).toLowerCase().trim();
    if (key) {
      questionCounts.set(key, (questionCounts.get(key) ?? 0) + 1);
    }
  }

  return Array.from(questionCounts.entries())
    .map(([question, count]) => ({ question, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface UnansweredQuestion {
  question: string;
  date: string;
}

export async function getUnansweredQuestions(
  workspaceId: string,
  period: "today" | "7d" | "30d" | "90d" = "30d",
  limit = 10,
): Promise<UnansweredQuestion[]> {
  const { from, to } = getTimeRange(period);
  const messages = await db.message.getByWorkspace(workspaceId);

  const inRange = messages.filter((m) => {
    const d = new Date(m.date_created);
    return d >= new Date(from) && d <= new Date(to);
  });

  // Find user messages that weren't followed by an assistant message within a reasonable time
  // For simplicity, find user messages with no subsequent assistant message in same conversation
  const conversationMessages = new Map<
    string,
    { role: "user" | "assistant" | "system"; content: string; date: string }[]
  >();
  for (const msg of inRange) {
    if (!conversationMessages.has(msg.conversation)) {
      conversationMessages.set(msg.conversation, []);
    }
    conversationMessages.get(msg.conversation)!.push({
      role: msg.role,
      content: msg.content,
      date: msg.date_created,
    });
  }

  const unanswered: UnansweredQuestion[] = [];
  for (const [, msgs] of conversationMessages) {
    const sorted = [...msgs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].role === "user") {
        // Check if there's an assistant message after this
        const hasAssistantReply = sorted.slice(i + 1).some((m) => m.role === "assistant");
        if (!hasAssistantReply) {
          unanswered.push({ question: sorted[i].content.slice(0, 100), date: sorted[i].date });
        }
      }
    }
  }

  return unanswered.slice(0, limit);
}

export interface AgentAnalytics {
  agentId: string;
  agentName: string;
  totalConversations: number;
  aiResolved: number;
  humanHandoffs: number;
  resolutionRate: number | null;
  avgResponseTimeMs: number | null;
  totalMessages: number;
}

export async function getAgentAnalyticsData(agentId: string): Promise<AgentAnalytics | null> {
  const agent = await db.agent.getById(agentId);
  if (!agent) return null;

  const conversations = await db.conversation.getByAgent(agentId);
  const messages = await db.message.getByAgent(agentId);
  const conversationsById = new Map(conversations.map((c) => [c.id, c]));

  // Filter messages for this agent's conversations
  const agentMessages = messages.filter((m) => conversationsById.has(m.conversation));

  const totalConversations = conversations.length;
  const aiResolved = conversations.filter((c) => c.status === "resolved").length;
  const humanHandoffs = conversations.filter((c) => c.status === "with_human" || c.status === "human_required").length;
  const closedConversations = aiResolved + humanHandoffs;
  const resolutionRate = closedConversations > 0 ? (aiResolved / closedConversations) * 100 : null;

  // Average response time
  let avgResponseTimeMs: number | null = null;
  if (agentMessages.length > 0) {
    const conversationMessages = new Map<string, typeof agentMessages>();
    for (const msg of agentMessages) {
      if (!conversationMessages.has(msg.conversation)) {
        conversationMessages.set(msg.conversation, []);
      }
      conversationMessages.get(msg.conversation)!.push(msg);
    }

    const responseTimes: number[] = [];
    for (const [, msgs] of conversationMessages) {
      const sorted = [...msgs].sort((a, b) => new Date(a.date_created).getTime() - new Date(b.date_created).getTime());
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].role === "user" && sorted[i + 1].role === "assistant") {
          const t1 = new Date(sorted[i].date_created).getTime();
          const t2 = new Date(sorted[i + 1].date_created).getTime();
          responseTimes.push(t2 - t1);
        }
      }
    }
    if (responseTimes.length > 0) {
      avgResponseTimeMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }
  }

  return {
    agentId: agent.id,
    agentName: agent.name,
    totalConversations,
    aiResolved,
    humanHandoffs,
    resolutionRate,
    avgResponseTimeMs,
    totalMessages: agentMessages.length,
  };
}
