import type { AgentEntity, CustomerEntity, MessageEntity } from "@/lib/db/entities";

export interface ConversationSummary {
  messageCount: number;
  firstMessageAt: string;
  lastMessageAt: string;
  topics: string[];
  customerSatisfaction: "positive" | "neutral" | "negative" | "unknown";
  resolutionStatus: "unresolved" | "in_progress" | "resolved";
}

export interface CustomerContext {
  name: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  previousConversations: number;
  totalBookings: number;
  notes: string | null;
  interests: string[];
}

export interface BusinessKnowledge {
  sources: Array<{
    title: string;
    content: string;
    relevance: number;
  }>;
  totalSources: number;
}

export interface AgentMemory {
  conversation: ConversationSummary;
  customer: CustomerContext | null;
  knowledge: BusinessKnowledge;
  instructions: string;
}

export function buildConversationSummary(messages: MessageEntity[]): ConversationSummary {
  if (messages.length === 0) {
    return {
      messageCount: 0,
      firstMessageAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      topics: [],
      customerSatisfaction: "unknown",
      resolutionStatus: "unresolved",
    };
  }

  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const allContent = messages.map((m) => m.content).join(" ").toLowerCase();

  const positiveWords = ["thank", "great", "perfect", "awesome", "excellent", "good"];
  const negativeWords = ["bad", "terrible", "awful", "angry", "frustrated", "useless"];

  let satisfaction: ConversationSummary["customerSatisfaction"] = "neutral";
  for (const word of positiveWords) {
    if (allContent.includes(word)) {
      satisfaction = "positive";
      break;
    }
  }
  for (const word of negativeWords) {
    if (allContent.includes(word)) {
      satisfaction = "negative";
      break;
    }
  }

  const topics: string[] = [];
  const topicKeywords: Record<string, string[]> = {
    pricing: ["price", "cost", "how much", "budget", "expensive", "cheap"],
    services: ["service", "package", "offer", "provide", "do you"],
    booking: ["book", "appointment", "schedule", "available", "when"],
    support: ["help", "issue", "problem", "broken", "error", "fix"],
    refund: ["refund", "cancel", "money back", "return"],
    technical: ["install", "setup", "integrate", "api", "code"],
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    for (const keyword of keywords) {
      if (allContent.includes(keyword)) {
        topics.push(topic);
        break;
      }
    }
  }

  return {
    messageCount: messages.length,
    firstMessageAt: messages[0]?.date_created ?? new Date().toISOString(),
    lastMessageAt: messages[messages.length - 1]?.date_created ?? new Date().toISOString(),
    topics: [...new Set(topics)],
    customerSatisfaction: satisfaction,
    resolutionStatus: assistantMessages.length > userMessages.length ? "resolved" : "in_progress",
  };
}

export function buildCustomerContext(
  customer: CustomerEntity | null,
  conversations: number,
): CustomerContext | null {
  if (!customer) return null;

  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    stage: customer.stage,
    previousConversations: conversations,
    totalBookings: customer.bookings?.length ?? 0,
    notes: customer.notes,
    interests: extractInterests(customer.notes),
  };
}

function extractInterests(notes: string | null): string[] {
  if (!notes) return [];
  const interests: string[] = [];
  const interestKeywords = [
    "interested in",
    "looking for",
    "wants",
    "needs",
    "budget",
    "timeline",
  ];

  for (const keyword of interestKeywords) {
    const idx = notes.toLowerCase().indexOf(keyword);
    if (idx !== -1) {
      const snippet = notes.substring(idx, idx + 50).trim();
      interests.push(snippet);
    }
  }

  return interests;
}

export function buildBusinessKnowledge(sources: Array<{ title: string; content: string }>): BusinessKnowledge {
  return {
    sources: sources.map((s) => ({
      title: s.title,
      content: s.content.substring(0, 500),
      relevance: 1.0,
    })),
    totalSources: sources.length,
  };
}

export function buildAgentMemory(
  agent: AgentEntity,
  messages: MessageEntity[],
  customer: CustomerEntity | null,
  knowledgeSources: Array<{ title: string; content: string }>,
  conversationCount: number,
): AgentMemory {
  return {
    conversation: buildConversationSummary(messages),
    customer: buildCustomerContext(customer, conversationCount),
    knowledge: buildBusinessKnowledge(knowledgeSources),
    instructions: agent.system_prompt,
  };
}

export function formatMemoryForPrompt(memory: AgentMemory): string {
  const parts: string[] = [];

  parts.push(memory.instructions);

  if (memory.customer) {
    const customer = memory.customer;
    parts.push("\n## Customer Context");
    if (customer.name) parts.push(`Name: ${customer.name}`);
    if (customer.stage) parts.push(`Stage: ${customer.stage}`);
    if (customer.previousConversations > 0) {
      parts.push(`Previous conversations: ${customer.previousConversations}`);
    }
    if (customer.interests.length > 0) {
      parts.push(`Known interests: ${customer.interests.join(", ")}`);
    }
    if (customer.notes) parts.push(`Notes: ${customer.notes}`);
  }

  const conv = memory.conversation;
  if (conv.messageCount > 0) {
    parts.push("\n## Conversation Context");
    parts.push(`Messages: ${conv.messageCount}`);
    if (conv.topics.length > 0) {
      parts.push(`Topics discussed: ${conv.topics.join(", ")}`);
    }
    parts.push(`Customer mood: ${conv.customerSatisfaction}`);
  }

  if (memory.knowledge.sources.length > 0) {
    parts.push("\n## Business Knowledge");
    parts.push(`Available sources: ${memory.knowledge.totalSources}`);
    for (const source of memory.knowledge.sources) {
      parts.push(`\n[${source.title}]\n${source.content}`);
    }
  }

  return parts.join("\n");
}
