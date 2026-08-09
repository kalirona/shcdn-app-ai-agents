import { NextRequest, NextResponse } from "next/server";

import { getProvider } from "@/lib/billing/provider";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
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

    await handleWebhookEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handleWebhookEvent(event: {
  type: string;
  workspaceId: string;
  subscriptionId?: string;
  plan?: "starter" | "business" | "pro";
  amount?: number;
  currency?: string;
}) {
  switch (event.type) {
    case "subscription.created":
      // TODO: Create subscription record in Directus
      // await subscriptionRepo.create({ workspaceId, plan, subscriptionId, status: "active" });
      console.log("Subscription created:", event.workspaceId, event.plan);
      break;

    case "subscription.updated":
      // TODO: Update subscription in Directus
      console.log("Subscription updated:", event.workspaceId);
      break;

    case "subscription.canceled":
      // TODO: Mark subscription as canceled in Directus
      console.log("Subscription canceled:", event.workspaceId);
      break;

    case "invoice.paid":
      // TODO: Record payment in Directus
      // await invoiceRepo.create({ workspaceId, amount, currency, status: "paid" });
      console.log("Invoice paid:", event.workspaceId, event.amount);
      break;

    case "invoice.payment_failed":
      // TODO: Mark subscription as past_due
      console.log("Payment failed:", event.workspaceId);
      break;

    default:
      console.log("Unhandled webhook event:", event.type);
  }
}
