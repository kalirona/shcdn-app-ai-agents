"use server";

import { revalidatePath } from "next/cache";

import type { z } from "zod";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { PERMISSIONS } from "@/lib/auth/roles";
import { sendMessageSchema, replyToConversationSchema, updateConversationStatusSchema } from "@/lib/auth/schemas/conversation.schema";
import { enforceMessageLimit } from "@/lib/billing/usage-enforcement";
import * as conversationRepo from "@/lib/db/repositories/conversation.repo";

export async function getWorkspaceConversations(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.CONVERSATIONS_READ);

  try {
    const conversations = await conversationRepo.getWorkspaceConversations(workspaceId);
    return { success: true, conversations };
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return { error: "Failed to load conversations.", conversations: [] };
  }
}

export async function getConversationById(conversationId: string) {
  try {
    const conversation = await conversationRepo.getConversationById(conversationId);
    if (!conversation) {
      return { error: "Conversation not found.", conversation: null, messages: [] };
    }

    try {
      await requireWorkspaceAccess(conversation.workspace, PERMISSIONS.CONVERSATIONS_READ);
    } catch (accessError) {
      const message = accessError instanceof Error ? accessError.message : "";
      if (message.includes("not a member of this workspace")) {
        return {
          error: `This conversation belongs to a different workspace. Please switch to the correct workspace to view it.`,
          conversation: null,
          messages: [],
        };
      }
      throw accessError;
    }

    const messages = await conversationRepo.getConversationMessages(conversationId);
    return { success: true, conversation, messages };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message, conversation: null, messages: [] };
    }
    console.error("Failed to fetch conversation:", error);
    return { error: "Failed to load conversation.", conversation: null, messages: [] };
  }
}

export async function sendMessage(data: z.infer<typeof sendMessageSchema>) {
  const parsed = sendMessageSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const conversation = await conversationRepo.getConversationById(parsed.data.conversationId);
    if (!conversation) {
      return { error: "Conversation not found." };
    }
    try {
      await requireWorkspaceAccess(conversation.workspace, PERMISSIONS.CONVERSATIONS_READ);
    } catch (accessError) {
      const message = accessError instanceof Error ? accessError.message : "";
      if (message.includes("not a member of this workspace")) {
        return { error: "This conversation belongs to a different workspace." };
      }
      throw accessError;
    }

    const limitCheck = await enforceMessageLimit(conversation.workspace);
    if (!limitCheck.allowed) {
      return { error: limitCheck.error ?? "Message limit reached." };
    }

    const message = await conversationRepo.createMessage({
      conversation: parsed.data.conversationId,
      role: "assistant",
      content: parsed.data.content,
    });

    revalidatePath("/dashboard/conversations");
    return { success: true, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to send message:", error);
    return { error: "Failed to send message. Please try again." };
  }
}

export async function replyToConversation(data: z.infer<typeof replyToConversationSchema>) {
  const parsed = replyToConversationSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const conversation = await conversationRepo.getConversationById(parsed.data.conversationId);
    if (!conversation) {
      return { error: "Conversation not found." };
    }
    try {
      await requireWorkspaceAccess(conversation.workspace, PERMISSIONS.CONVERSATIONS_TAKEOVER);
    } catch (accessError) {
      const message = accessError instanceof Error ? accessError.message : "";
      if (message.includes("not a member of this workspace")) {
        return { error: "This conversation belongs to a different workspace." };
      }
      throw accessError;
    }

    if (conversation.status !== "with_human" && conversation.status !== "human_required") {
      return { error: "Can only reply to conversations with a human agent." };
    }

    const message = await conversationRepo.createMessage({
      conversation: parsed.data.conversationId,
      role: "assistant",
      content: parsed.data.content,
      metadata: { sender: "human" },
    });

    revalidatePath("/dashboard/conversations");
    return { success: true, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to reply to conversation:", error);
    return { error: "Failed to send reply. Please try again." };
  }
}

export async function updateConversationStatus(data: z.infer<typeof updateConversationStatusSchema>) {
  const parsed = updateConversationStatusSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const conversation = await conversationRepo.getConversationById(parsed.data.conversationId);
    if (!conversation) {
      return { error: "Conversation not found." };
    }
    try {
      await requireWorkspaceAccess(conversation.workspace, PERMISSIONS.CONVERSATIONS_TAKEOVER);
    } catch (accessError) {
      const message = accessError instanceof Error ? accessError.message : "";
      if (message.includes("not a member of this workspace")) {
        return { error: "This conversation belongs to a different workspace." };
      }
      throw accessError;
    }

    await conversationRepo.updateConversationStatus(parsed.data.conversationId, parsed.data.status);
    revalidatePath("/dashboard/conversations");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to update conversation status:", error);
    return { error: "Failed to update status. Please try again." };
  }
}

export async function takeOverConversation(conversationId: string) {
  try {
    const conversation = await conversationRepo.getConversationById(conversationId);
    if (!conversation) {
      return { error: "Conversation not found." };
    }
    try {
      await requireWorkspaceAccess(conversation.workspace, PERMISSIONS.CONVERSATIONS_TAKEOVER);
    } catch (accessError) {
      const message = accessError instanceof Error ? accessError.message : "";
      if (message.includes("not a member of this workspace")) {
        return { error: "This conversation belongs to a different workspace." };
      }
      throw accessError;
    }

    await conversationRepo.updateConversationStatus(
      conversationId,
      "with_human",
      "human_took_over",
      "Human agent took over conversation",
    );
    revalidatePath("/dashboard/conversations");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to take over conversation:", error);
    return { error: "Failed to take over. Please try again." };
  }
}

export async function returnToAi(conversationId: string) {
  try {
    const conversation = await conversationRepo.getConversationById(conversationId);
    if (!conversation) {
      return { error: "Conversation not found." };
    }
    try {
      await requireWorkspaceAccess(conversation.workspace, PERMISSIONS.CONVERSATIONS_TAKEOVER);
    } catch (accessError) {
      const message = accessError instanceof Error ? accessError.message : "";
      if (message.includes("not a member of this workspace")) {
        return { error: "This conversation belongs to a different workspace." };
      }
      throw accessError;
    }

    await conversationRepo.updateConversationStatus(conversationId, "active");
    revalidatePath("/dashboard/conversations");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to return to AI:", error);
    return { error: "Failed to return to AI. Please try again." };
  }
}

export async function resolveConversation(conversationId: string) {
  try {
    const conversation = await conversationRepo.getConversationById(conversationId);
    if (!conversation) {
      return { error: "Conversation not found." };
    }
    try {
      await requireWorkspaceAccess(conversation.workspace, PERMISSIONS.CONVERSATIONS_TAKEOVER);
    } catch (accessError) {
      const message = accessError instanceof Error ? accessError.message : "";
      if (message.includes("not a member of this workspace")) {
        return { error: "This conversation belongs to a different workspace." };
      }
      throw accessError;
    }

    await conversationRepo.updateConversationStatus(conversationId, "resolved");
    revalidatePath("/dashboard/conversations");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to resolve conversation:", error);
    return { error: "Failed to resolve. Please try again." };
  }
}

export async function exportConversations(workspaceId: string, format: "csv" | "json" = "csv") {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.CONVERSATIONS_EXPORT);

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
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to export conversations:", error);
    return { error: "Failed to export conversations." };
  }
}
