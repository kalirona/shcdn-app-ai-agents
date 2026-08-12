import type { PlanName } from "@/lib/auth/schemas/billing.schema";
import { classifyPayPalEvent, extractSubscriptionId, getPayPalPlanId } from "@/lib/paypal";

import { createHmac, timingSafeEqual } from "node:crypto";

export type PaymentProvider = "stripe" | "paypal" | "lemon_squeezy";

export interface Subscription {
  id: string;
  workspaceId: string;
  plan: PlanName;
  status: "active" | "canceled" | "past_due" | "trialing";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  paymentProvider: PaymentProvider;
  paymentProviderSubscriptionId: string | null;
}

export interface Invoice {
  id: string;
  workspaceId: string;
  amount: number;
  currency: string;
  status: "paid" | "open" | "void" | "uncollectible";
  date: string;
  pdfUrl: string | null;
  hostedUrl: string | null;
}

export interface UsageRecord {
  id: string;
  workspaceId: string;
  metric: string;
  amount: number;
  date: string;
}

export interface PaymentMethod {
  id: string;
  type: string;
  last4: string | null;
  brand: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

export interface CheckoutSession {
  url: string;
  sessionId: string;
}

export interface SubscriptionResult {
  subscription: Subscription | null;
  error?: string;
}

export interface PaymentProviderAdapter {
  createCheckoutSession(plan: PlanName, workspaceId: string, customerEmail: string): Promise<CheckoutSession>;

  createCustomerPortalSession(workspaceId: string): Promise<string>;

  cancelSubscription(subscriptionId: string, immediately?: boolean): Promise<void>;

  getSubscription(subscriptionId: string): Promise<Partial<Subscription>>;

  verifyWebhookSignature(payload: string, signature: string): boolean;

  parseWebhookEvent(payload: Record<string, unknown>): WebhookEvent | null;
}

export interface WebhookEvent {
  type:
    | "subscription.created"
    | "subscription.updated"
    | "subscription.canceled"
    | "subscription.past_due"
    | "invoice.paid"
    | "invoice.payment_failed";
  workspaceId: string;
  subscriptionId?: string;
  plan?: PlanName;
  amount?: number;
  currency?: string;
}

export function getProvider(provider: PaymentProvider): PaymentProviderAdapter {
  switch (provider) {
    case "stripe":
      return createStripeProvider();
    case "paypal":
      return createPayPalProvider();
    case "lemon_squeezy":
      return createLemonSqueezyProvider();
  }
}

function createStripeProvider(): PaymentProviderAdapter {
  return {
    async createCheckoutSession(plan, workspaceId, customerEmail) {
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        },
        body: new URLSearchParams({
          customer_email: customerEmail,
          "line_items[0][price]": getStripePriceId(plan),
          "line_items[0][quantity]": "1",
          mode: "subscription",
          success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing?success=true`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`,
          "metadata[workspace_id]": workspaceId,
          "subscription_data[metadata][workspace_id]": workspaceId,
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Stripe checkout error: ${error}`);
      }

      const data = await response.json();
      return { url: data.url, sessionId: data.id };
    },

    async createCustomerPortalSession(workspaceId) {
      // TODO: Look up Stripe customer ID from workspace
      const customerId = await getStripeCustomerId(workspaceId);

      const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        },
        body: new URLSearchParams({
          customer: customerId,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`,
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Stripe portal error: ${error}`);
      }

      const data = await response.json();
      return data.url;
    },

    async cancelSubscription(subscriptionId, immediately = false) {
      const url = immediately
        ? `https://api.stripe.com/v1/subscriptions/${subscriptionId}`
        : `https://api.stripe.com/v1/subscriptions/${subscriptionId}`;

      const body = immediately ? null : new URLSearchParams({ cancel_at_period_end: "true" }).toString();

      const response = await fetch(url, {
        method: immediately ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        },
        body,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Stripe cancel error: ${error}`);
      }
    },

    async getSubscription(subscriptionId) {
      const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Stripe get subscription error: ${error}`);
      }

      const data = await response.json();
      return {
        id: data.id,
        status: data.status,
        currentPeriodStart: new Date(data.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(data.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: data.cancel_at_period_end,
      };
    },

    verifyWebhookSignature(payload, signature) {
      // Stripe webhook verification using HMAC-SHA256
      const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
      try {
        const hmac = createHmac("sha256", secret);
        hmac.update(payload, "utf8");
        const expectedSignature = hmac.digest("hex");
        const signatureParts = signature.split(",");
        for (const part of signatureParts) {
          const [version, hash] = part.split("=");
          if (version === "v1" && hash === expectedSignature) {
            return true;
          }
        }
        return false;
      } catch {
        return false;
      }
    },

    parseWebhookEvent(payload: Record<string, unknown>) {
      const eventType = payload.type as string;

      const eventMap: Record<string, WebhookEvent["type"]> = {
        "customer.subscription.created": "subscription.created",
        "customer.subscription.updated": "subscription.updated",
        "customer.subscription.deleted": "subscription.canceled",
        "customer.subscription.trial_will_end": "subscription.updated",
        "invoice.paid": "invoice.paid",
        "invoice.payment_failed": "invoice.payment_failed",
      };

      const mappedType = eventMap[eventType];
      if (!mappedType) return null;

      const data = ((payload.data as Record<string, unknown>)?.object as Record<string, unknown>) ?? {};

      return {
        type: mappedType,
        workspaceId: ((data.metadata as Record<string, unknown>)?.workspace_id as string) ?? "",
        subscriptionId: data.id as string,
        plan: (data.metadata as Record<string, unknown>)?.plan as PlanName | undefined,
        amount: data.amount_due ? (data.amount_due as number) / 100 : undefined,
        currency: data.currency as string,
      };
    },
  };
}

function createPayPalProvider(): PaymentProviderAdapter {
  return {
    async createCheckoutSession(plan, workspaceId, customerEmail) {
      const { createPayPalSubscription } = await import("@/lib/paypal");
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const created = await createPayPalSubscription({
        plan,
        workspaceId,
        customerEmail,
        returnUrl: `${baseUrl}/dashboard/settings/billing?paypal=success`,
        cancelUrl: `${baseUrl}/dashboard/settings/billing?paypal=cancelled`,
      });

      return {
        url: created.approveUrl,
        sessionId: created.id,
      };
    },

    async createCustomerPortalSession(workspaceId) {
      // PayPal doesn't have a native portal; the customer manages the
      // subscription from their PayPal account.
      const { getPayPalEnvironment } = await import("@/lib/paypal");
      return getPayPalEnvironment() === "live"
        ? "https://www.paypal.com/myaccount/autopay"
        : "https://www.sandbox.paypal.com/myaccount/autopay";
    },

    async cancelSubscription(subscriptionId) {
      const { cancelPayPalSubscription } = await import("@/lib/paypal");
      await cancelPayPalSubscription(subscriptionId, "Customer requested cancellation");
    },

    async getSubscription(subscriptionId) {
      const { getPayPalSubscription } = await import("@/lib/paypal");
      const data = await getPayPalSubscription(subscriptionId);
      const status = ["active", "trialing", "past_due", "canceled"].includes(data.status)
        ? (data.status as Subscription["status"])
        : "past_due";
      return {
        id: data.id,
        status,
        currentPeriodStart: data.nextBillingTime ?? undefined,
        currentPeriodEnd: data.nextBillingTime ?? undefined,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      };
    },

    verifyWebhookSignature() {
      // PayPal webhook verification is a server-side postback to PayPal's
      // verify-webhook-signature API and is implemented in @/lib/paypal
      // (verifyPayPalWebhook), used by the /api/webhooks/paypal route.
      return false;
    },

    parseWebhookEvent(payload: Record<string, unknown>) {
      const eventType = payload.event_type as string;
      const lifecycle = classifyPayPalEvent(eventType);
      if (lifecycle === "unsupported") return null;

      const resource = (payload.resource ?? {}) as Record<string, unknown>;
      const eventMap: Partial<Record<string, WebhookEvent["type"]>> = {
        activated: "subscription.created",
        reactivated: "subscription.updated",
        created: "subscription.created",
        updated: "subscription.updated",
        cancelled: "subscription.canceled",
        expired: "subscription.canceled",
        suspended: "subscription.past_due",
        payment_failed: "invoice.payment_failed",
        payment_completed: "invoice.paid",
      };

      const subscriptionId = extractSubscriptionId(payload);
      const planId = resource.plan_id as string | undefined;
      const plan = planId
        ? (["starter", "business", "pro"] as const).find((p) => getPayPalPlanId(p) === planId)
        : undefined;

      return {
        type: (eventMap[lifecycle] ?? "subscription.updated") as WebhookEvent["type"],
        workspaceId: "",
        subscriptionId,
        plan,
        amount: ((resource.amount ?? {}) as Record<string, unknown>)?.total as number | undefined,
        currency: ((resource.amount ?? {}) as Record<string, unknown>)?.currency as string | undefined,
      };
    },
  };
}

function createLemonSqueezyProvider(): PaymentProviderAdapter {
  return {
    async createCheckoutSession(plan, workspaceId, customerEmail) {
      const variantId = getLemonSqueezyVariantId(plan);

      const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          data: {
            type: "checkouts",
            attributes: {
              custom_price: null,
              product_options: {
                name: `Agent AI - ${plan}`,
                description: `Subscription to Agent AI ${plan} plan`,
                redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing?success=true`,
                receipt_button_text: "Go to Dashboard",
                receipt_link_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`,
              },
              checkout_options: {
                embed: false,
                media: true,
                logo: true,
              },
              checkout_data: {
                email: customerEmail,
                custom: {
                  workspace_id: workspaceId,
                },
              },
              preview: false,
              discount: false,
            },
            relationships: {
              store: {
                data: {
                  type: "stores",
                  id: process.env.LEMON_SQUEEZY_STORE_ID,
                },
              },
              variant: {
                data: {
                  type: "variants",
                  id: variantId,
                },
              },
            },
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Lemon Squeezy checkout error: ${error}`);
      }

      const data = await response.json();
      return {
        url: data.data.attributes.url,
        sessionId: data.data.id,
      };
    },

    async createCustomerPortalSession(workspaceId) {
      // Lemon Squeezy provides customer portal URLs
      // TODO: Look up customer ID from workspace
      return `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`;
    },

    async cancelSubscription(subscriptionId) {
      const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          data: {
            type: "subscriptions",
            id: subscriptionId,
            attributes: {
              cancelled: true,
            },
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Lemon Squeezy cancel error: ${error}`);
      }
    },

    async getSubscription(subscriptionId) {
      const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
        headers: {
          Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Lemon Squeezy get subscription error: ${error}`);
      }

      const data = await response.json();
      return {
        id: data.data.id,
        status: data.data.attributes.status,
        currentPeriodStart: data.data.attributes.created_at,
        currentPeriodEnd: data.data.attributes.renews_at,
        cancelAtPeriodEnd: data.data.attributes.cancelled,
      };
    },

    verifyWebhookSignature(payload, signature) {
      const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET ?? "";
      try {
        const hmac = createHmac("sha256", secret);
        hmac.update(payload, "utf8");
        const digest = hmac.digest("hex");

        const signatureBuffer = Buffer.from(signature, "utf8");
        const digestBuffer = Buffer.from(digest, "utf8");

        if (signatureBuffer.length !== digestBuffer.length) return false;
        return timingSafeEqual(signatureBuffer, digestBuffer);
      } catch {
        return false;
      }
    },

    parseWebhookEvent(payload: Record<string, unknown>) {
      const meta = (payload.meta as Record<string, unknown>) ?? {};
      const eventName = meta.event_name as string;

      const eventMap: Record<string, WebhookEvent["type"]> = {
        subscription_created: "subscription.created",
        subscription_updated: "subscription.updated",
        subscription_cancelled: "subscription.canceled",
        subscription_resumed: "subscription.updated",
        subscription_expired: "subscription.canceled",
        order_created: "invoice.paid",
        order_refunded: "invoice.payment_failed",
      };

      const mappedType = eventMap[eventName];
      if (!mappedType) return null;

      const data = (payload.data as Record<string, unknown>) ?? {};
      const customData = (meta.custom_data as Record<string, unknown>) ?? {};

      return {
        type: mappedType,
        workspaceId: (customData.workspace_id as string) ?? "",
        subscriptionId: data.id as string,
        plan: customData.plan as PlanName | undefined,
      };
    },
  };
}

function getStripePriceId(plan: PlanName): string {
  const prefix = process.env.NODE_ENV === "production" ? "price_live_" : "price_test_";
  return `${prefix}${plan}`;
}

function getLemonSqueezyVariantId(plan: PlanName): string {
  const ids = {
    starter: process.env.LS_STARTER_VARIANT ?? "",
    business: process.env.LS_BUSINESS_VARIANT ?? "",
    pro: process.env.LS_PRO_VARIANT ?? "",
  };
  return ids[plan];
}

async function getStripeCustomerId(workspaceId: string): Promise<string> {
  // TODO: Look up from workspace data
  return `cus_placeholder_${workspaceId}`;
}
