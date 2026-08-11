"use server";

import { revalidatePath } from "next/cache";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";
import { PERMISSIONS } from "@/lib/auth/roles";
import { PLAN_LIMITS, type PlanName } from "@/lib/auth/schemas/billing.schema";
import { getProvider } from "@/lib/billing/provider";
import * as subscriptionRepo from "@/lib/db/repositories/subscription.repo";
import { getWorkspaceUsage } from "@/lib/db/repositories/usage.repo";
import { checkRateLimit } from "@/lib/security/rate-limiter";

async function getCurrentContext() {
  const current = await getCurrentUser();
  if (!current.user.id || !current.currentWorkspace) {
    throw new Error("Unauthorized: You must be logged in.");
  }
  return { userId: current.user.id, email: current.user.email, workspaceId: current.currentWorkspace.id };
}

export async function createCheckoutSession(plan: PlanName, paymentProvider: "stripe" | "paypal" | "lemon_squeezy") {
  const { userId, email, workspaceId } = await getCurrentContext();
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.SETTINGS_UPDATE);

  const rateLimit = checkRateLimit(`checkout:${userId}`, 5, 60000);
  if (!rateLimit.allowed) {
    return { error: "Too many checkout attempts. Please wait before trying again." };
  }

  try {
    const provider = getProvider(paymentProvider);
    const session = await provider.createCheckoutSession(plan, workspaceId, email);

    return { success: true, url: session.url, sessionId: session.sessionId };
  } catch (error) {
    console.error("Checkout session error:", error);
    return { error: "Failed to create checkout session. Please try again." };
  }
}

export async function getBillingStatus(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.SETTINGS_UPDATE);

  try {
    const subscription = await subscriptionRepo.getSubscriptionByWorkspace(workspaceId);
    const usage = await getWorkspaceUsage(workspaceId);
    const plan = subscription?.plan ?? "starter";

    return {
      success: true,
      subscription,
      usage,
      limits: PLAN_LIMITS[plan],
    };
  } catch (error) {
    console.error("Failed to fetch billing status:", error);
    return { error: "Failed to load billing information." };
  }
}

export async function cancelSubscription(workspaceId: string, _reason?: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.SETTINGS_UPDATE);

  try {
    const subscription = await subscriptionRepo.getSubscriptionByWorkspace(workspaceId);
    if (!subscription?.paymentProviderSubscriptionId) {
      return { error: "No active subscription found." };
    }

    const provider = getProvider(subscription.paymentProvider as "stripe" | "paypal" | "lemon_squeezy");
    await provider.cancelSubscription(subscription.paymentProviderSubscriptionId);

    await subscriptionRepo.updateSubscription(workspaceId, {
      status: "canceled",
      cancelAtPeriodEnd: true,
    });

    revalidatePath("/dashboard/settings/billing");
    return { success: true };
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return { error: "Failed to cancel subscription. Please try again." };
  }
}

export async function changePlan(workspaceId: string, newPlan: PlanName) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.SETTINGS_UPDATE);

  try {
    await subscriptionRepo.updateSubscription(workspaceId, { plan: newPlan });

    revalidatePath("/dashboard/settings/billing");
    return { success: true };
  } catch (error) {
    console.error("Change plan error:", error);
    return { error: "Failed to change plan. Please try again." };
  }
}

export async function createCustomerPortalSession(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.SETTINGS_UPDATE);

  try {
    const subscription = await subscriptionRepo.getSubscriptionByWorkspace(workspaceId);
    const providerName = subscription?.paymentProvider ?? "stripe";
    const provider = getProvider(providerName as "stripe" | "paypal" | "lemon_squeezy");
    const url = await provider.createCustomerPortalSession(workspaceId);
    return { success: true, url };
  } catch (error) {
    console.error("Customer portal error:", error);
    return { error: "Failed to open customer portal." };
  }
}

export async function checkUsageLimit(workspaceId: string, metric: keyof typeof PLAN_LIMITS.starter) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.SETTINGS_UPDATE);

  try {
    const usage = await getWorkspaceUsage(workspaceId);
    const subscription = await subscriptionRepo.getSubscriptionByWorkspace(workspaceId);
    const plan = subscription?.plan ?? "starter";
    const limit = PLAN_LIMITS[plan][metric];
    const current = usage[metric] ?? 0;

    return {
      success: true,
      allowed: current < limit,
      usage: current,
      limit,
      remaining: Math.max(0, limit - current),
    };
  } catch (error) {
    console.error("Usage check error:", error);
    return { error: "Failed to check usage limit." };
  }
}

export async function recordUsage(workspaceId: string, _metric: string, _amount: number) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.SETTINGS_UPDATE);

  try {
    // Usage is computed on-demand from Directus collections; no separate counter.
    return { success: true };
  } catch (error) {
    console.error("Record usage error:", error);
    return { error: "Failed to record usage." };
  }
}
