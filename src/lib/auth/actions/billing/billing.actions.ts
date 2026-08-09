"use server";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/auth-context";
import {
  PLAN_LIMITS,
  PLAN_PRICES,
  type PlanName,
} from "@/lib/auth/schemas/billing.schema";
import { getProvider } from "@/lib/billing/provider";
import { checkRateLimit } from "@/lib/security/rate-limiter";

async function requireAuth() {
  const { isAuthenticated, user } = await getAuthContext();
  if (!isAuthenticated || !user) {
    throw new Error("Unauthorized: You must be logged in.");
  }
  return user;
}

export async function createCheckoutSession(
  plan: PlanName,
  paymentProvider: "stripe" | "paypal" | "lemon_squeezy",
) {
  const user = await requireAuth();

  const rateLimit = checkRateLimit(`checkout:${user.id}`, 5, 60000);
  if (!rateLimit.allowed) {
    return { error: "Too many checkout attempts. Please wait before trying again." };
  }

  try {
    const provider = getProvider(paymentProvider);
    const session = await provider.createCheckoutSession(
      plan,
      "placeholder-workspace-id",
      user.email,
    );

    return { success: true, url: session.url, sessionId: session.sessionId };
  } catch (error) {
    console.error("Checkout session error:", error);
    return { error: "Failed to create checkout session. Please try again." };
  }
}

export async function getBillingStatus(workspaceId: string) {
  await requireAuth();

  try {
    // TODO: Fetch from Directus
    // const subscription = await subscriptionRepo.getByWorkspace(workspaceId);
    // const usage = await usageRepo.getCurrentUsage(workspaceId);

    return {
      success: true,
      subscription: null,
      usage: {
        ai_messages: 0,
        ai_tokens: 0,
        conversations: 0,
        agents: 0,
        knowledge_storage: 0,
        documents: 0,
        team_members: 0,
        bookings: 0,
      },
      limits: PLAN_LIMITS.starter,
    };
  } catch (error) {
    console.error("Failed to fetch billing status:", error);
    return { error: "Failed to load billing information." };
  }
}

export async function cancelSubscription(workspaceId: string, reason?: string) {
  await requireAuth();

  try {
    // TODO: Fetch subscription from Directus
    // const subscription = await subscriptionRepo.getByWorkspace(workspaceId);
    // if (!subscription) return { error: "No active subscription found." };
    // const provider = getProvider(subscription.paymentProvider);
    // await provider.cancelSubscription(subscription.paymentProviderSubscriptionId);
    // await subscriptionRepo.updateStatus(subscription.id, "canceled");

    revalidatePath("/dashboard/settings/billing");
    return { success: true };
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return { error: "Failed to cancel subscription. Please try again." };
  }
}

export async function changePlan(workspaceId: string, newPlan: PlanName) {
  await requireAuth();

  try {
    // TODO: Update subscription in Directus
    // const subscription = await subscriptionRepo.getByWorkspace(workspaceId);
    // if (!subscription) return { error: "No active subscription found." };
    // const provider = getProvider(subscription.paymentProvider);
    // await provider.updateSubscriptionPlan(subscription.paymentProviderSubscriptionId, newPlan);
    // await subscriptionRepo.updatePlan(subscription.id, newPlan);

    revalidatePath("/dashboard/settings/billing");
    return { success: true };
  } catch (error) {
    console.error("Change plan error:", error);
    return { error: "Failed to change plan. Please try again." };
  }
}

export async function createCustomerPortalSession(workspaceId: string) {
  await requireAuth();

  try {
    const provider = getProvider("stripe");
    const url = await provider.createCustomerPortalSession(workspaceId);
    return { success: true, url };
  } catch (error) {
    console.error("Customer portal error:", error);
    return { error: "Failed to open customer portal." };
  }
}

export async function checkUsageLimit(
  workspaceId: string,
  metric: keyof typeof PLAN_LIMITS.starter,
) {
  await requireAuth();

  try {
    // TODO: Fetch current usage from Directus
    // const usage = await usageRepo.getCurrentUsage(workspaceId, metric);
    // const subscription = await subscriptionRepo.getByWorkspace(workspaceId);
    // const plan = subscription?.plan ?? "starter";
    // const limit = PLAN_LIMITS[plan][metric];

    const usage = 0;
    const limit = PLAN_LIMITS.starter[metric];

    return {
      success: true,
      allowed: usage < limit,
      usage,
      limit,
      remaining: Math.max(0, limit - usage),
    };
  } catch (error) {
    console.error("Usage check error:", error);
    return { error: "Failed to check usage limit." };
  }
}

export async function recordUsage(
  workspaceId: string,
  metric: string,
  amount: number,
) {
  await requireAuth();

  try {
    // TODO: Store in Directus
    // await usageRepo.record(workspaceId, metric, amount);
    return { success: true };
  } catch (error) {
    console.error("Record usage error:", error);
    return { error: "Failed to record usage." };
  }
}

export { PLAN_LIMITS };
