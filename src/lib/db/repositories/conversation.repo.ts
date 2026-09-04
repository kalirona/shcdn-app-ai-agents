import { createHash } from "node:crypto";

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
 * The Supabase conversations table stores the session key in customer_id
 * (a uuid column). Widget sessions are crypto.randomUUID() strings, but any
 * non-UUID session id (legacy localStorage values, custom integrations) would
 * make Postgres reject the query (22P02) and break the whole chat. Normalize
 * non-UUID session ids into a stable, deterministic UUID so the same session
 * id always maps to the same conversation.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toSessionKey(sessionId: string): string {
  if (UUID_RE.test(sessionId)) return sessionId;
  return createHash("sha256").update(`widget-session:${sessionId}`).digest("hex").slice(0, 32)
    .replace(/^(.{8})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4-");
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
  const sessionKey = toSessionKey(params.sessionId);
  const existing = await db.conversation.getBySession(sessionKey);
  if (existing[0]) return existing[0];

  return createConversation({
    workspace: params.workspace,
    agent: params.agent,
    customer: sessionKey,
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
