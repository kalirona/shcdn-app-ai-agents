import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import type { PlanName } from "@/lib/auth/schemas/billing.schema";
import { getWorkspaceByProviderSubscriptionId, updateSubscription } from "@/lib/db/repositories/subscription.repo";
import { isWebhookEventProcessed, recordWebhookEvent } from "@/lib/db/repositories/webhook-event.repo";
import {
  classifyPayPalEvent,
  extractSubscriptionId,
  getPayPalWebhookId,
  isPayPalConfigured,
  resolvePlanFromPayPalPlanId,
  verifyPayPalWebhook,
} from "@/lib/paypal";

/**
 * Inbound PayPal webhook endpoint.
 *
 * Receives PayPal subscription lifecycle notifications, verifies authenticity
 * via PayPal's verify-webhook-signature postback, enforces idempotency, then
 * resolves the owning workspace strictly from the stored PayPal subscription
 * ID (never from the request body) before updating internal subscription state.
 */
export async function POST(request: NextRequest) {
  if (!isPayPalConfigured() || !getPayPalWebhookId()) {
    return NextResponse.json({ error: "PAYPAL_NOT_CONFIGURED" }, { status: 503 });
  }

  const transmissionId = request.headers.get("paypal-transmission-id") ?? "";
  const transmissionTime = request.headers.get("paypal-transmission-time") ?? "";
  const transmissionSig = request.headers.get("paypal-transmission-sig") ?? "";
  const certUrl = request.headers.get("paypal-cert-url") ?? "";
  const authAlgo = request.headers.get("paypal-auth-algo") ?? "";

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return NextResponse.json({ error: "Missing verification headers" }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Reject tampered payloads / wrong webhook configuration.
  const verified = await verifyPayPalWebhook(
    { transmissionId, transmissionTime, transmissionSig, certUrl, authAlgo },
    payload,
  );
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const eventId = typeof payload.id === "string" ? payload.id : "";
  const eventType = typeof payload.event_type === "string" ? payload.event_type : "";
  if (!eventId || !eventType) {
    return NextResponse.json({ error: "Missing event id/type" }, { status: 400 });
  }

  // Idempotency: a duplicate PayPal delivery of the same event is ignored.
  if (await isWebhookEventProcessed("paypal", eventId)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const subscriptionId = extractSubscriptionId(payload);
    if (!subscriptionId) {
      return NextResponse.json({ received: true });
    }

    // Server-controlled workspace resolution: PayPal subscription ID -> workspace.
    const workspace = await getWorkspaceByProviderSubscriptionId("paypal", subscriptionId);

    const lifecycle = classifyPayPalEvent(eventType);
    const resource = payload.resource as {
      plan_id?: string;
      billing_info?: { next_billing_time?: string; last_payment?: { time?: string } };
    };

    const planId = resource.plan_id;
    const plan = planId ? resolvePlanFromPayPalPlanId(planId) : null;
    const nextBillingTime = resource.billing_info?.next_billing_time ?? null;

    await applyLifecycleEvent({
      lifecycle,
      workspaceId: workspace?.id ?? null,
      subscriptionId,
      planName: plan,
      nextBillingTime,
      eventType,
      eventId,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("PayPal webhook processing error:", error);
    await recordWebhookEvent({
      eventId,
      provider: "paypal",
      eventType,
      subscriptionId: extractSubscriptionId(payload) || null,
      workspaceId: null,
      status: "failed",
    }).catch(() => undefined);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

interface ApplyLifecycleParams {
  lifecycle: string;
  workspaceId: string | null;
  subscriptionId: string;
  planName: PlanName | null;
  nextBillingTime: string | null;
  eventType: string;
  eventId: string;
}

/**
 * Maps PayPal lifecycle events to the EXISTING internal subscription states.
 *
 *   PayPal                              -> internal
 *   BILLING.SUBSCRIPTION.ACTIVATED       -> active
 *   BILLING.SUBSCRIPTION.RE-ACTIVATED    -> active
 *   PAYMENT.SALE.COMPLETED               -> active (reset on every paid cycle)
 *   BILLING.SUBSCRIPTION.PAYMENT.FAILED  -> past_due
 *   BILLING.SUBSCRIPTION.SUSPENDED       -> past_due
 *   BILLING.SUBSCRIPTION.CANCELLED       -> canceled + cancelAtPeriodEnd
 *   BILLING.SUBSCRIPTION.EXPIRED         -> canceled
 *   BILLING.SUBSCRIPTION.CREATED/UPDATED -> informational (no activation)
 *
 * No new internal states are introduced.
 */
async function applyLifecycleEvent(params: ApplyLifecycleParams) {
  const { workspaceId, subscriptionId, planName, nextBillingTime, eventType, eventId } = params;

  if (!workspaceId) {
    // Unknown subscription: record it, do not invent a workspace or activate anything.
    await recordWebhookEvent({
      eventId,
      provider: "paypal",
      eventType,
      subscriptionId,
      workspaceId: null,
      status: "failed",
    });
    return;
  }

  const update: Parameters<typeof updateSubscription>[1] = {
    paymentProvider: "paypal",
    paymentProviderSubscriptionId: subscriptionId,
    currentPeriodEnd: nextBillingTime,
  };

  switch (params.lifecycle) {
    case "activated":
    case "reactivated":
      update.status = "active";
      update.cancelAtPeriodEnd = false;
      break;
    case "payment_completed":
      update.status = "active";
      update.cancelAtPeriodEnd = false;
      break;
    case "payment_failed":
    case "suspended":
      update.status = "past_due";
      break;
    case "cancelled":
      update.status = "canceled";
      update.cancelAtPeriodEnd = true;
      break;
    case "expired":
      update.status = "canceled";
      update.cancelAtPeriodEnd = true;
      break;
    // created / updated are informational; never mark active on them alone.
    default:
      break;
  }

  if (planName) {
    update.plan = planName;
  }

  await updateSubscription(workspaceId, update);
  revalidatePath("/dashboard/settings/billing");

  await recordWebhookEvent({
    eventId,
    provider: "paypal",
    eventType,
    subscriptionId,
    workspaceId,
    status: "processed",
  });
}
