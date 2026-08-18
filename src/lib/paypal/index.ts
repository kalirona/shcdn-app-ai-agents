export { getPayPalAccessToken, PayPalApiError, paypalApi } from "./client";
export {
  getPayPalBaseUrl,
  getPayPalClientId,
  getPayPalEnvironment,
  getPayPalPlanId,
  getPayPalWebhookId,
  isPayPalConfigured,
  type PayPalEnvironment,
  resolvePlanFromPayPalPlanId,
} from "./config";
export {
  type CreatedPayPalSubscription,
  type CreatePayPalSubscriptionParams,
  cancelPayPalSubscription,
  createPayPalSubscription,
  getPayPalSubscription,
  type PayPalSubscriptionDetails,
  suspendPayPalSubscription,
} from "./subscriptions";
export {
  classifyPayPalEvent,
  extractSubscriptionId,
  PAYPAL_EVENT_ACTIVATED,
  PAYPAL_EVENT_CANCELLED,
  PAYPAL_EVENT_CREATED,
  PAYPAL_EVENT_EXPIRED,
  PAYPAL_EVENT_PAYMENT_COMPLETED,
  PAYPAL_EVENT_PAYMENT_FAILED,
  PAYPAL_EVENT_REACTIVATED,
  PAYPAL_EVENT_SUSPENDED,
  PAYPAL_EVENT_UPDATED,
  type PayPalWebhookHeaders,
  type PayPalWebhookResource,
  verifyPayPalWebhook,
} from "./webhooks";

import type { PlanName } from "@/lib/auth/schemas/billing.schema";

import { getPayPalEnvironment, isPayPalConfigured } from "./config";
import { getPayPalSubscription } from "./subscriptions";

export interface PayPalConnectionStatus {
  configured: boolean;
  environment: string;
  planMappings: Record<PlanName, boolean>;
  webhookConfigured: boolean;
  subscriptionResolvable: boolean;
}

/**
 * Safe, non-secret diagnostic of PayPal readiness. Returns booleans and
 * environment/mapping information only; never returns a client secret or
 * access token. When credentials are missing, `configured` is false and the
 * caller should present PAYPAL_NOT_CONFIGURED.
 */
export async function getPayPalConnectionStatus(): Promise<PayPalConnectionStatus> {
  const configured = isPayPalConfigured();
  const planMappings = {
    starter: Boolean(process.env.PAYPAL_STARTER_PLAN_ID),
    business: Boolean(process.env.PAYPAL_BUSINESS_PLAN_ID),
    pro: Boolean(process.env.PAYPAL_PRO_PLAN_ID),
  } as Record<PlanName, boolean>;

  let subscriptionResolvable = false;
  if (configured) {
    try {
      await getPayPalSubscription("placeholder-not-a-real-id");
    } catch (error) {
      // A 400/404 for a bogus ID means auth + connectivity are fine.
      subscriptionResolvable = error instanceof Error && /PayPal API error \(4\d\d\)/.test(error.message);
    }
  }

  return {
    configured,
    environment: getPayPalEnvironment(),
    planMappings,
    webhookConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID),
    subscriptionResolvable,
  };
}
