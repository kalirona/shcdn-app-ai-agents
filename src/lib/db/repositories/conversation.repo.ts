import { db } from "../client";
import type { ConversationEntity, MessageEntity } from "../entities";

export interface CreateConversationParams {
  workspace: string;
  agent: string;
  customerEmail?: string;
  customerName?: string;
}

export async function createConversation(params: CreateConversationParams): Promise<ConversationEntity> {
  return db.conversation.create({
    workspace: params.workspace,
    agent: params.agent,
    customer_email: params.customerEmail ?? null,
    customer_name: params.customerName ?? null,
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
  status: "active" | "resolved" | "handoff",
): Promise<ConversationEntity> {
  return db.conversation.update(id, { status });
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
