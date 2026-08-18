import { z } from "zod";

export const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const analyticsQuerySchema = z.object({
  workspaceId: z.string().min(1),
  agentId: z.string().optional(),
  dateRange: dateRangeSchema.optional(),
});

export const agentAnalyticsSchema = z.object({
  agentId: z.string().min(1),
  dateRange: dateRangeSchema.optional(),
});

export type DateRange = z.infer<typeof dateRangeSchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type AgentAnalyticsQuery = z.infer<typeof agentAnalyticsSchema>;
