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

/** Paid plan keys only (used by PLAN_LIMITS / PLAN_PRICES). */
export type PlanName = keyof typeof PLAN_LIMITS;

/** All selectable tiers shown in the plans grid, including the free tier. */
export type PlanTier = PlanName | "free";

export const PLAN_ORDER: PlanTier[] = ["free", "starter", "business", "pro"];

export const PLAN_DISPLAY: Record<PlanTier, string> = {
  free: "Free",
  starter: "Starter",
  business: "Business",
  pro: "Pro",
};

export const PLAN_TAGLINES: Record<PlanTier, string> = {
  free: "Explore Agent AI at no cost.",
  starter: "For solo businesses getting started.",
  business: "For growing teams that want real scale.",
  pro: "For high-volume operations.",
};

export type UsageMetric = keyof typeof PLAN_LIMITS.starter;
