import { z } from "zod";

export const widgetConfigSchema = z.object({
  agentId: z.string().min(1),
  position: z.enum(["bottom-right", "bottom-left"]).default("bottom-right"),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#3b82f6"),
  greeting: z.string().max(200).optional(),
  avatar: z.string().url().nullable().optional(),
  showSources: z.boolean().default(true),
});

export const widgetChatSchema = z.object({
  agentId: z.string().min(1),
  sessionId: z.string().min(1),
  message: z.string().trim().min(1).max(2000),
});

export type WidgetConfig = z.infer<typeof widgetConfigSchema>;
export type WidgetChat = z.infer<typeof widgetChatSchema>;

export interface WidgetSession {
  id: string;
  agentId: string;
  createdAt: string;
  expiresAt: string;
}
