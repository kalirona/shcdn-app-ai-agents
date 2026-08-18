import { type NextRequest, NextResponse } from "next/server";

import { getProvider } from "@/lib/billing/provider";
import * as subscriptionRepo from "@/lib/db/repositories/subscription.repo";

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerName } = await params;

  if (!["stripe", "paypal", "lemon_squeezy"].includes(providerName)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const provider = getProvider(providerName as "stripe" | "paypal" | "lemon_squeezy");

  const body = await request.text();
  const signature =
    request.headers.get("stripe-signature") ??
    request.headers.get("paypal-transmission-id") ??
    request.headers.get("x-signature") ??
    "";

  const isValid = provider.verifyWebhookSignature(body, signature);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(body);
    const event = provider.parseWebhookEvent(payload);

    if (!event) {
      return NextResponse.json({ received: true });
    }

    await handleWebhookEvent(event, providerName);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handleWebhookEvent(
  event: {
    type: string;
    workspaceId: string;
    subscriptionId?: string;
    plan?: "starter" | "business" | "pro";
    amount?: number;
    currency?: string;
  },
  providerName: string,
) {
  const { workspaceId, subscriptionId } = event;

  if (!workspaceId) {
    console.log("Webhook event without workspaceId, skipping:", event.type);
    return;
  }

  switch (event.type) {
    case "subscription.created":
      await subscriptionRepo.updateSubscription(workspaceId, {
        plan: event.plan ?? "starter",
        status: "active",
        paymentProvider: providerName,
        paymentProviderSubscriptionId: subscriptionId ?? null,
        cancelAtPeriodEnd: false,
      });
      console.log("Webhook subscription created:", event.type);
      break;

    case "subscription.updated":
      await subscriptionRepo.updateSubscription(workspaceId, {
        plan: event.plan,
        paymentProviderSubscriptionId: subscriptionId,
      });
      console.log("Webhook subscription updated:", event.type);
      break;

    case "subscription.canceled":
      await subscriptionRepo.updateSubscription(workspaceId, {
        status: "canceled",
        cancelAtPeriodEnd: true,
      });
      console.log("Webhook subscription canceled:", event.type);
      break;

    case "subscription.past_due":
      await subscriptionRepo.updateSubscription(workspaceId, {
        status: "past_due",
      });
      console.log("Webhook subscription past due:", event.type);
      break;

    case "invoice.paid":
      // Reset subscription to active when an invoice is paid.
      await subscriptionRepo.updateSubscription(workspaceId, {
        status: "active",
      });
      console.log("Webhook invoice paid:", event.type);
      break;

    case "invoice.payment_failed":
      await subscriptionRepo.updateSubscription(workspaceId, {
        status: "past_due",
      });
      console.log("Webhook payment failed:", event.type);
      break;

    default:
      console.log("Unhandled webhook event:", event.type);
  }
}
