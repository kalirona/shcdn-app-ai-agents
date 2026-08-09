import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().trim().min(1).max(4000),
});

export const chatRequestSchema = z.object({
  agentId: z.string().min(1, "Agent ID is required."),
  message: z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message must be 2000 characters or less."),
  conversationId: z.string().optional(),
  history: z.array(chatMessageSchema).max(20).optional(),
});

export const embeddingRequestSchema = z.object({
  text: z.string().trim().min(1).max(8000),
});

export const vectorSearchSchema = z.object({
  embedding: z.array(z.number()),
  workspaceId: z.string().min(1),
  agentId: z.string().optional(),
  limit: z.number().min(1).max(20).default(5),
  threshold: z.number().min(0).max(1).default(0.7),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type EmbeddingRequest = z.infer<typeof embeddingRequestSchema>;
export type VectorSearchRequest = z.infer<typeof vectorSearchSchema>;
