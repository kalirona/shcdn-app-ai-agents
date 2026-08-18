import { dispatchWebhook } from "@/lib/webhooks/delivery";

import { db } from "../client";
import type { ConversationEntity, MessageEntity } from "../entities";

export interface CreateConversationParams {
  workspace: string;
  agent: string;
  customer?: string;
  customerEmail?: string;
  customerName?: string;
}

export async function createConversation(params: CreateConversationParams): Promise<ConversationEntity> {
  const conversation = await db.conversation.create({
    workspace: params.workspace,
    agent: params.agent,
    customer: params.customer ?? null,
    customer_email: params.customerEmail ?? null,
    customer_name: params.customerName ?? null,
    handoff_trigger: null,
    handoff_reason: null,
  });

  await dispatchWebhook(params.workspace, "conversation.created", { conversation });
  return conversation;
}

/**
 * Resolve a widget/session conversation. The customer column is used as the
 * stable session key (a UUID string) so a session always maps to the same
 * conversation regardless of the auto-increment primary key.
 */
export async function getOrCreateSessionConversation(params: {
  sessionId: string;
  workspace: string;
  agent: string;
  customerName?: string;
  customerEmail?: string;
}): Promise<ConversationEntity> {
  const existing = await db.conversation.getBySession(params.sessionId);
  if (existing[0]) return existing[0];

  return createConversation({
    workspace: params.workspace,
    agent: params.agent,
    customer: params.sessionId,
    customerEmail: params.customerEmail,
    customerName: params.customerName,
  });
}

export async function getWorkspaceConversations(workspaceId: string): Promise<ConversationEntity[]> {
  return db.conversation.getByWorkspace(workspaceId);
}

export async function getAgentConversations(agentId: string): Promise<ConversationEntity[]> {
  return db.conversation.getByAgent(agentId);
}

export async function getConversationById(id: string): Promise<ConversationEntity | null> {
  try {
    return await db.conversation.getById(id);
  } catch {
    return null;
  }
}

export async function updateConversationStatus(
  id: string,
  status: "active" | "human_required" | "with_human" | "resolved",
  handoffTrigger?: string,
  handoffReason?: string,
): Promise<ConversationEntity> {
  const conversation = await db.conversation.update(id, {
    status,
    handoff_trigger: handoffTrigger ?? null,
    handoff_reason: handoffReason ?? null,
  });

  if (status === "with_human" || status === "human_required") {
    await dispatchWebhook(conversation.workspace, "conversation.handoff", { conversation });
  }
  return conversation;
}

export async function deleteConversation(id: string): Promise<void> {
  await db.conversation.delete(id);
}

export interface CreateMessageParams {
  conversation: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: Array<{ title: string; url: string | null; chunk_id: string | null }>;
  metadata?: Record<string, unknown>;
}

export async function createMessage(params: CreateMessageParams): Promise<MessageEntity> {
  return db.message.create({
    conversation: params.conversation,
    role: params.role,
    content: params.content,
    sources: params.sources ?? null,
    metadata: params.metadata ?? {},
  });
}

export async function getConversationMessages(conversationId: string): Promise<MessageEntity[]> {
  return db.message.getByConversation(conversationId);
}

export async function deleteMessage(id: string): Promise<void> {
  await db.message.delete(id);
}
