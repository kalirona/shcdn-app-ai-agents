import { z } from "zod";

export const createSubscriptionSchema = z.object({
  plan: z.enum(["starter", "business", "pro"]),
  paymentProvider: z.enum(["stripe", "paypal", "lemon_squeezy"]),
});

export const cancelSubscriptionSchema = z.object({
  workspaceId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export const changePlanSchema = z.object({
  workspaceId: z.string().min(1),
  newPlan: z.enum(["starter", "business", "pro"]),
});

export const recordUsageSchema = z.object({
  workspaceId: z.string().min(1),
  metric: z.enum([
    "ai_messages",
    "ai_tokens",
    "conversations",
    "agents",
    "knowledge_storage",
    "documents",
    "team_members",
    "bookings",
  ] as [string, ...string[]]),
  amount: z.number().min(1),
});

export const usageLimitCheckSchema = z.object({
  workspaceId: z.string().min(1),
  metric: z.enum([
    "ai_messages",
    "ai_tokens",
    "conversations",
    "agents",
    "knowledge_storage",
    "documents",
    "team_members",
    "bookings",
  ]),
});

export const webhookEventSchema = z.object({
  provider: z.enum(["stripe", "paypal", "lemon_squeezy"]),
  eventType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
export type RecordUsageInput = z.infer<typeof recordUsageSchema>;
export type WebhookEventInput = z.infer<typeof webhookEventSchema>;

export const PLAN_LIMITS = {
  starter: {
    ai_messages: 1000,
    ai_tokens: 100000,
    conversations: 500,
    agents: 1,
    knowledge_storage: 50, // MB
    documents: 10,
    team_members: 1,
    bookings: 50,
  },
  business: {
    ai_messages: 5000,
    ai_tokens: 500000,
    conversations: 2500,
    agents: 5,
    knowledge_storage: 500, // MB
    documents: 50,
    team_members: 5,
    bookings: 250,
  },
  pro: {
    ai_messages: 20000,
    ai_tokens: 2000000,
    conversations: 10000,
    agents: 15,
    knowledge_storage: 2048, // MB
    documents: 200,
    team_members: 20,
    bookings: 1000,
  },
} as const;

export const PLAN_PRICES = {
  starter: { monthly: 29, yearly: 290 },
  business: { monthly: 79, yearly: 790 },
  pro: { monthly: 149, yearly: 1490 },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;
