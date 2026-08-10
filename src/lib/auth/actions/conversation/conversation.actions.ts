"use server";

import { revalidatePath } from "next/cache";

import type { z } from "zod";

import { getAuthContext } from "@/lib/auth/auth-context";
import { sendMessageSchema, updateConversationStatusSchema } from "@/lib/auth/schemas/conversation.schema";
import * as conversationRepo from "@/lib/db/repositories/conversation.repo";

async function requireAuth() {
  const { isAuthenticated, user } = await getAuthContext();
  if (!isAuthenticated || !user) {
    throw new Error("Unauthorized: You must be logged in.");
  }
  return user;
}

export async function getWorkspaceConversations(workspaceId: string) {
  await requireAuth();

  try {
    const conversations = await conversationRepo.getWorkspaceConversations(workspaceId);
    return { success: true, conversations };
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return { error: "Failed to load conversations.", conversations: [] };
  }
}

export async function getConversationById(conversationId: string) {
  await requireAuth();

  try {
    const conversation = await conversationRepo.getConversationById(conversationId);
    if (!conversation) {
      return { error: "Conversation not found.", conversation: null, messages: [] };
    }

    const messages = await conversationRepo.getConversationMessages(conversationId);
    return { success: true, conversation, messages };
  } catch (error) {
    console.error("Failed to fetch conversation:", error);
    return { error: "Failed to load conversation.", conversation: null, messages: [] };
  }
}

export async function sendMessage(data: z.infer<typeof sendMessageSchema>) {
  const user = await requireAuth();

  const parsed = sendMessageSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const message = await conversationRepo.createMessage({
      conversation: parsed.data.conversationId,
      role: "assistant",
      content: parsed.data.content,
    });

    revalidatePath("/dashboard/conversations");
    return { success: true, message };
  } catch (error) {
    console.error("Failed to send message:", error);
    return { error: "Failed to send message. Please try again." };
  }
}

export async function updateConversationStatus(data: z.infer<typeof updateConversationStatusSchema>) {
  await requireAuth();

  const parsed = updateConversationStatusSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await conversationRepo.updateConversationStatus(parsed.data.conversationId, parsed.data.status);
    revalidatePath("/dashboard/conversations");
    return { success: true };
  } catch (error) {
    console.error("Failed to update conversation status:", error);
    return { error: "Failed to update status. Please try again." };
  }
}

export async function takeOverConversation(conversationId: string) {
  await requireAuth();

  try {
    await conversationRepo.updateConversationStatus(conversationId, "with_human", "human_took_over", "Human agent took over conversation");
    revalidatePath("/dashboard/conversations");
    return { success: true };
  } catch (error) {
    console.error("Failed to take over conversation:", error);
    return { error: "Failed to take over. Please try again." };
  }
}

export async function returnToAi(conversationId: string) {
  await requireAuth();

  try {
    await conversationRepo.updateConversationStatus(conversationId, "active");
    revalidatePath("/dashboard/conversations");
    return { success: true };
  } catch (error) {
    console.error("Failed to return to AI:", error);
    return { error: "Failed to return to AI. Please try again." };
  }
}

export async function resolveConversation(conversationId: string) {
  await requireAuth();

  try {
    await conversationRepo.updateConversationStatus(conversationId, "resolved");
    revalidatePath("/dashboard/conversations");
    return { success: true };
  } catch (error) {
    console.error("Failed to resolve conversation:", error);
    return { error: "Failed to resolve. Please try again." };
  }
}

export async function exportConversations(workspaceId: string, format: "csv" | "json" = "csv") {
  await requireAuth();

  try {
    const conversations = await conversationRepo.getWorkspaceConversations(workspaceId);

    if (format === "json") {
      return { success: true, data: JSON.stringify(conversations, null, 2), filename: "conversations.json" };
    }

    const headers = ["ID", "Status", "Customer", "Email", "Agent", "Created", "Updated"];
    const rows = conversations.map((c) => [
      c.id,
      c.status,
      c.customer_name ?? "",
      c.customer_email ?? "",
      c.agent,
      c.date_created,
      c.date_updated,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    return { success: true, data: csv, filename: "conversations.csv" };
  } catch (error) {
    console.error("Failed to export conversations:", error);
    return { error: "Failed to export conversations." };
  }
}
