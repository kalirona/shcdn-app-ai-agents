import type { PlanName } from "@/lib/auth/schemas/billing.schema";

import { getPayPalAccessToken, paypalApi } from "./client";
import { getPayPalPlanId } from "./config";

export interface PayPalSubscriptionDetails {
  id: string;
  status: string;
  planId: string | null;
  customId: string | null;
  subscriberEmail: string | null;
  nextBillingTime: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface CreatePayPalSubscriptionParams {
  plan: PlanName;
  workspaceId: string;
  customerEmail: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreatedPayPalSubscription {
  id: string;
  status: string;
  approveUrl: string;
}

/**
 * Creates a PayPal billing subscription. The workspace is carried in
 * `custom_id` so an inbound webhook can later resolve the owning workspace
 * without trusting anything sent by the browser.
 *
 * `user_action: SUBSCRIBE_NOW` returns an approve link the customer follows.
 * Approval alone does NOT activate billing; only a verified PayPal webhook
 * may drive the internal subscription to active.
 */
export async function createPayPalSubscription(
  params: CreatePayPalSubscriptionParams,
): Promise<CreatedPayPalSubscription> {
  const planId = getPayPalPlanId(params.plan);
  if (!planId) {
    throw new Error(`No PayPal plan configured for plan "${params.plan}"`);
  }

  const data = await paypalApi<{
    id: string;
    status: string;
    links?: Array<{ rel: string; href: string }>;
  }>("/v1/billing/subscriptions", {
    method: "POST",
    body: {
      plan_id: planId,
      custom_id: params.workspaceId,
      subscriber: {
        email_address: params.customerEmail,
      },
      application_context: {
        brand_name: "Agent AI",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    },
  });

  const approveUrl = data.links?.find((link) => link.rel === "approve")?.href ?? "";
  return { id: data.id, status: data.status, approveUrl };
}

/** Fetch current PayPal subscription details. Used by webhook resolution and diagnostics. */
export async function getPayPalSubscription(subscriptionId: string): Promise<PayPalSubscriptionDetails> {
  const data = await paypalApi<{
    id: string;
    status: string;
    plan_id?: string;
    custom_id?: string;
    subscriber?: { email_address?: string };
    billing_info?: { next_billing_time?: string };
  }>(`/v1/billing/subscriptions/${subscriptionId}`);

  return {
    id: data.id,
    status: data.status ?? "",
    planId: data.plan_id ?? null,
    customId: data.custom_id ?? null,
    subscriberEmail: data.subscriber?.email_address ?? null,
    nextBillingTime: data.billing_info?.next_billing_time ?? null,
    cancelAtPeriodEnd: false,
  };
}

/** Cancels a PayPal subscription server-side, preserving the existing record. */
export async function cancelPayPalSubscription(subscriptionId: string, reason: string): Promise<void> {
  await getPayPalAccessToken();
  await paypalApi(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

/** Suspends a PayPal subscription. Available for cases where the lifecycle requires it. */
export async function suspendPayPalSubscription(subscriptionId: string, reason: string): Promise<void> {
  await getPayPalAccessToken();
  await paypalApi(`/v1/billing/subscriptions/${subscriptionId}/suspend`, {
    method: "POST",
    body: { reason },
  });
}
