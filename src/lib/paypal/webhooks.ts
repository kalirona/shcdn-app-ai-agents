import { getPayPalAccessToken, paypalApi } from "./client";
import { getPayPalWebhookId } from "./config";

export interface PayPalWebhookHeaders {
  transmissionId: string;
  transmissionTime: string;
  transmissionSig: string;
  certUrl: string;
  authAlgo: string;
}

/**
 * Verifies a PayPal webhook notification by posting the event and the raw
 * transmission headers back to PayPal's verify-webhook-signature endpoint.
 *
 * This is the authoritative verification method: PayPal's servers confirm the
 * signature, timestamp, and payload against their own record for the
 * configured webhook ID. On any non-SUCCESS outcome (bad signature, wrong
 * webhook ID, tampered payload) the caller must reject the event.
 *
 * The raw event body must be posted back exactly as received - we always
 * pass through the original parsed JSON object, never a re-serialised copy
 * that could be normalised differently.
 */
export async function verifyPayPalWebhook(
  headers: PayPalWebhookHeaders,
  event: Record<string, unknown>,
): Promise<boolean> {
  const webhookId = getPayPalWebhookId();
  if (!webhookId) return false;

  try {
    const token = await getPayPalAccessToken();
    const response = await paypalApi<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: {
        auth_algo: headers.authAlgo,
        cert_url: headers.certUrl,
        transmission_id: headers.transmissionId,
        transmission_sig: headers.transmissionSig,
        transmission_time: headers.transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      },
    });

    return response.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}

/**
 * Event types a PayPal subscription lifecycle emits that Agent AI cares about.
 * Names come from the current PayPal REST webhooks documentation.
 */
export const PAYPAL_EVENT_ACTIVATED = "BILLING.SUBSCRIPTION.ACTIVATED";
export const PAYPAL_EVENT_PAYMENT_COMPLETED = "PAYMENT.SALE.COMPLETED";
export const PAYPAL_EVENT_PAYMENT_FAILED = "BILLING.SUBSCRIPTION.PAYMENT.FAILED";
export const PAYPAL_EVENT_SUSPENDED = "BILLING.SUBSCRIPTION.SUSPENDED";
export const PAYPAL_EVENT_CANCELLED = "BILLING.SUBSCRIPTION.CANCELLED";
export const PAYPAL_EVENT_EXPIRED = "BILLING.SUBSCRIPTION.EXPIRED";
export const PAYPAL_EVENT_CREATED = "BILLING.SUBSCRIPTION.CREATED";
export const PAYPAL_EVENT_UPDATED = "BILLING.SUBSCRIPTION.UPDATED";
export const PAYPAL_EVENT_REACTIVATED = "BILLING.SUBSCRIPTION.RE-ACTIVATED";

export type PayPalLifecycleEvent =
  | "activated"
  | "payment_completed"
  | "payment_failed"
  | "suspended"
  | "cancelled"
  | "expired"
  | "created"
  | "updated"
  | "reactivated"
  | "unsupported";

const EVENT_NAME_TO_LIFECYCLE: Record<string, PayPalLifecycleEvent> = {
  [PAYPAL_EVENT_ACTIVATED]: "activated",
  [PAYPAL_EVENT_PAYMENT_COMPLETED]: "payment_completed",
  [PAYPAL_EVENT_PAYMENT_FAILED]: "payment_failed",
  [PAYPAL_EVENT_SUSPENDED]: "suspended",
  [PAYPAL_EVENT_CANCELLED]: "cancelled",
  [PAYPAL_EVENT_EXPIRED]: "expired",
  [PAYPAL_EVENT_CREATED]: "created",
  [PAYPAL_EVENT_UPDATED]: "updated",
  [PAYPAL_EVENT_REACTIVATED]: "reactivated",
};

export function classifyPayPalEvent(eventType: string): PayPalLifecycleEvent {
  return EVENT_NAME_TO_LIFECYCLE[eventType] ?? "unsupported";
}

export interface PayPalWebhookResource {
  id?: string;
  plan_id?: string;
  custom_id?: string;
  status?: string;
  billing_agreement_id?: string;
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { time?: string };
  };
  amount?: { total?: string; currency_code?: string };
}

/**
 * Extracts the PayPal subscription ID from a webhook notification.
 *
 * - BILLING.SUBSCRIPTION.* events carry `resource.id` (the subscription).
 * - PAYMENT.SALE.* events carry the sale in `resource` but reference the
 *   billing agreement via `resource.billing_agreement_id`.
 */
export function extractSubscriptionId(event: Record<string, unknown>): string {
  const resource = (event.resource as PayPalWebhookResource | undefined) ?? {};
  const resourceType = event.resource_type as string | undefined;
  const resourceVersion = event.resource_version as string | undefined;

  if (resource.billing_agreement_id) {
    return String(resource.billing_agreement_id);
  }

  if (resourceType === "sale" || resourceVersion === "1.0") {
    const sale = resource as { billing_agreement_id?: string };
    if (sale.billing_agreement_id) return String(sale.billing_agreement_id);
  }

  return String(resource.id ?? "");
}
