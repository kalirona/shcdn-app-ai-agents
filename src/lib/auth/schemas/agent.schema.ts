import { z } from "zod";

export const createAgentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Agent name must be at least 2 characters.")
    .max(64, "Agent name must be 64 characters or less.")
    .regex(/^[a-zA-Z0-9\s\-_]+$/, "Only letters, numbers, spaces, hyphens, and underscores allowed."),
  description: z.string().trim().max(500, "Description must be 500 characters or less.").optional().or(z.literal("")),
  tone: z.enum(["professional", "friendly", "casual", "custom"]),
  greeting: z.string().trim().min(1, "Greeting is required.").max(200, "Greeting must be 200 characters or less."),
  fallbackMessage: z
    .string()
    .trim()
    .min(1, "Fallback message is required.")
    .max(500, "Fallback message must be 500 characters or less."),
  language: z.string().trim().length(2, "Language must be a 2-letter code.").default("en"),
  systemInstructions: z
    .string()
    .trim()
    .max(2000, "Instructions must be 2000 characters or less.")
    .optional()
    .or(z.literal("")),
  purpose: z.string().optional().default("custom"),
  primaryGoal: z.string().optional().default("answer_questions"),
  secondaryGoal: z.string().optional().default(""),
  fallbackAction: z.string().optional().default("transfer_human"),
  behaviors: z.array(z.string()).optional().default(["answer_questions", "human_handoff"]),
  allowedTools: z.array(z.string()).optional().default(["request_human"]),
});

export const updateAgentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Agent name must be at least 2 characters.")
    .max(64, "Agent name must be 64 characters or less.")
    .regex(/^[a-zA-Z0-9\s\-_]+$/, "Only letters, numbers, spaces, hyphens, and underscores allowed.")
    .optional(),
  description: z.string().trim().max(500, "Description must be 500 characters or less.").optional(),
  tone: z.enum(["professional", "friendly", "casual", "custom"]).optional(),
  greeting: z
    .string()
    .trim()
    .min(1, "Greeting is required.")
    .max(200, "Greeting must be 200 characters or less.")
    .optional(),
  fallbackMessage: z
    .string()
    .trim()
    .min(1, "Fallback message is required.")
    .max(500, "Fallback message must be 500 characters or less.")
    .optional(),
  language: z.string().trim().length(2, "Language must be a 2-letter code.").optional(),
  systemInstructions: z.string().trim().max(2000, "Instructions must be 2000 characters or less.").optional(),
  status: z.enum(["draft", "active", "paused"]).optional(),
});

export const updateAgentAppearanceSchema = z.object({
  avatar: z.string().nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color.")
    .optional(),
  position: z.enum(["bottom-right", "bottom-left"]).optional(),
  greeting: z.string().trim().max(200).optional(),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type UpdateAgentAppearanceInput = z.infer<typeof updateAgentAppearanceSchema>;
