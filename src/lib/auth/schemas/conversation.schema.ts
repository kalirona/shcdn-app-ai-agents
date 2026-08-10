import { z } from "zod";

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID is required."),
  content: z.string().trim().min(1, "Message cannot be empty.").max(4000),
});

export const updateConversationStatusSchema = z.object({
  conversationId: z.string().min(1),
  status: z.enum(["active", "human_required", "with_human", "resolved"]),
});

export const addInternalNoteSchema = z.object({
  conversationId: z.string().min(1),
  note: z.string().trim().min(1, "Note cannot be empty.").max(1000),
});

export const assignConversationSchema = z.object({
  conversationId: z.string().min(1),
  assigneeId: z.string().min(1),
});

export const filterConversationsSchema = z.object({
  status: z.enum(["active", "human_required", "with_human", "resolved", "all"]).optional(),
  agentId: z.string().optional(),
  search: z.string().max(200).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UpdateConversationStatusInput = z.infer<typeof updateConversationStatusSchema>;
export type AddInternalNoteInput = z.infer<typeof addInternalNoteSchema>;
export type AssignConversationInput = z.infer<typeof assignConversationSchema>;
export type FilterConversationsInput = z.infer<typeof filterConversationsSchema>;
