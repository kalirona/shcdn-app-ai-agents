"use server";

import { revalidatePath } from "next/cache";

import { getWorkspaceAccess, requireWorkspaceAccess } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";
import { PERMISSIONS } from "@/lib/auth/roles";
import { PLAN_LIMITS, type PlanName } from "@/lib/auth/schemas/billing.schema";
import { getProvider } from "@/lib/billing/provider";
import * as subscriptionRepo from "@/lib/db/repositories/subscription.repo";
import { getWorkspaceUsage } from "@/lib/db/repositories/usage.repo";
import { checkRateLimit } from "@/lib/security/rate-limiter";

const PAID_PLANS: PlanName[] = ["starter", "business", "pro"];

async function getCurrentContext() {
  const current = await getCurrentUser();
  if (!current.user.id || !current.currentWorkspace) {
    throw new Error("Unauthorized: You must be logged in.");
  }
  return { userId: current.user.id, email: current.user.email, workspaceId: current.currentWorkspace.id };
}

/** Returns whether the current user can manage billing for their current workspace. */
export async function getBillingAccess(workspaceId: string) {
  try {
    const access = await getWorkspaceAccess(workspaceId, PERMISSIONS.BILLING_MANAGE);
    return { success: true, canManageBilling: !!access };
  } catch {
    return { success: false, canManageBilling: false };
  }
}

/**
 * Safe server-side PayPal connection diagnostic.
 *
 * Requires BILLING_MANAGE and returns only non-secret information: whether
 * credentials/plans/webhook are configured, the environment, and whether the
 * sandbox API responds. Never returns the client secret or access token.
 * When credentials are missing, `configured` is false -> PAYPAL_NOT_CONFIGURED.
 */
export async function checkPayPalConnection(workspaceId: string) {
  const { checkWorkspaceAccess } = await import("@/lib/auth/access-core");
  const { getPayPalConnectionStatus } = await import("@/lib/paypal");
  const { getCurrentUser } = await import("@/lib/auth/actions/user.actions");
  const current = await getCurrentUser();
  if (!current.user.id) {
    return { error: "Unauthorized: You must be logged in." };
  }

  let access: Awaited<ReturnType<typeof checkWorkspaceAccess>>;
  try {
    access = await checkWorkspaceAccess(current.user.id, workspaceId, PERMISSIONS.BILLING_MANAGE);
  } catch {
    return { error: "Forbidden: Billing access required." };
  }
  void access;

  try {
    const status = await getPayPalConnectionStatus();
    if (!status.configured) {
      return { success: false, configured: false, reason: "PAYPAL_NOT_CONFIGURED" };
    }
    return { success: true, ...status };
  } catch (error) {
    console.error("PayPal connection check error:", error);
    return { error: "PayPal connection check failed." };
  }
}

export async function createCheckoutSession(plan: PlanName, paymentProvider: "stripe" | "paypal" | "lemon_squeezy") {
  const { userId, email, workspaceId } = await getCurrentContext();
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.BILLING_MANAGE);

  const rateLimit = checkRateLimit(`checkout:${userId}`, 5, 60000);
  if (!rateLimit.allowed) {
    return { error: "Too many checkout attempts. Please wait before trying again." };
  }

  if (paymentProvider === "paypal") {
    return createPayPalCheckout(plan, workspaceId, email);
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

/**
 * PayPal checkout: the server resolves the PayPal plan ID, creates a REAL
 * PayPal billing subscription, stores the pending provider reference, and
 * returns the PayPal approval URL.
 *
 * The internal subscription is NOT marked active here - only a verified
 * PayPal webhook may activate it.
 */
async function createPayPalCheckout(plan: PlanName, workspaceId: string, email: string) {
  const { isPayPalConfigured, getPayPalPlanId, createPayPalSubscription } = await import("@/lib/paypal");

  if (!isPayPalConfigured()) {
    return { error: "PAYPAL_NOT_CONFIGURED" };
  }
  if (!getPayPalPlanId(plan)) {
    return { error: `No PayPal plan configured for "${plan}".` };
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const created = await createPayPalSubscription({
      plan,
      workspaceId,
      customerEmail: email,
      returnUrl: `${baseUrl}/dashboard/settings/billing?paypal=success`,
      cancelUrl: `${baseUrl}/dashboard/settings/billing?paypal=cancelled`,
    });

    // Persist the pending provider reference without activating the subscription.
    await subscriptionRepo.updateSubscription(workspaceId, {
      paymentProvider: "paypal",
      paymentProviderSubscriptionId: created.id,
      paymentProviderCustomerId: null,
    });

    return { success: true, url: created.approveUrl, sessionId: created.id };
  } catch (error) {
    console.error("PayPal checkout error:", error);
    return { error: "Failed to create PayPal subscription. Please try again." };
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
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.BILLING_MANAGE);

  try {
    const subscription = await subscriptionRepo.getSubscriptionByWorkspace(workspaceId);

    if (subscription?.paymentProvider && subscription?.paymentProviderSubscriptionId) {
      const provider = getProvider(subscription.paymentProvider as "stripe" | "paypal" | "lemon_squeezy");
      try {
        await provider.cancelSubscription(subscription.paymentProviderSubscriptionId);
      } catch (error) {
        console.error("Provider cancel failed; continuing with local state update:", error);
      }
    }

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

export async function resumeSubscription(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.BILLING_MANAGE);

  try {
    const subscription = await subscriptionRepo.getSubscriptionByWorkspace(workspaceId);

    // PayPal does not support resuming a cancelled subscription; the customer
    // must start a new subscription. Never fake success for this state.
    if (subscription?.paymentProvider === "paypal" && subscription?.status === "canceled") {
      return {
        error:
          "PayPal doesn't support resuming a cancelled subscription. Please start a new subscription from the billing page.",
      };
    }

    await subscriptionRepo.updateSubscription(workspaceId, {
      status: subscription?.paymentProvider ? "active" : "trialing",
      cancelAtPeriodEnd: false,
    });

    revalidatePath("/dashboard/settings/billing");
    return { success: true };
  } catch (error) {
    console.error("Resume subscription error:", error);
    return { error: "Failed to resume subscription. Please try again." };
  }
}

export async function changePlan(workspaceId: string, newPlan: PlanName) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.BILLING_MANAGE);

  if (!PAID_PLANS.includes(newPlan)) {
    return { error: "Unsupported plan." };
  }

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
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.BILLING_MANAGE);

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
