import type { PlanName } from "@/lib/auth/schemas/billing.schema";

export type PayPalEnvironment = "sandbox" | "live";

/**
 * Resolves the configured PayPal environment.
 *
 * Supports `PAYPAL_ENVIRONMENT=sandbox` today and is architected to support
 * `PAYPAL_ENVIRONMENT=live` later. Defaults to sandbox when unset so that a
 * fresh environment never accidentally targets production.
 */
export function getPayPalEnvironment(): PayPalEnvironment {
  const value = process.env.PAYPAL_ENVIRONMENT ?? "sandbox";
  return value === "live" ? "live" : "sandbox";
}

export function getPayPalBaseUrl(): string {
  return getPayPalEnvironment() === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export function getPayPalClientId(): string {
  return process.env.PAYPAL_CLIENT_ID ?? "";
}

export function getPayPalClientSecret(): string {
  return process.env.PAYPAL_CLIENT_SECRET ?? "";
}

export function getPayPalWebhookId(): string {
  return process.env.PAYPAL_WEBHOOK_ID ?? "";
}

/** Whether server-side PayPal credentials are present and ready to use. */
export function isPayPalConfigured(): boolean {
  return Boolean(getPayPalClientId() && getPayPalClientSecret());
}

/**
 * Maps an internal Agent AI paid plan to the corresponding PayPal plan ID
 * configured on the server. `free` intentionally has no PayPal mapping.
 *
 * The server is the only source of truth for plan -> PayPal plan ID mapping.
 * A price/customer/workspace from the browser is never trusted.
 */
export function getPayPalPlanId(plan: PlanName): string {
  const ids: Record<PlanName, string> = {
    starter: process.env.PAYPAL_STARTER_PLAN_ID ?? "",
    business: process.env.PAYPAL_BUSINESS_PLAN_ID ?? "",
    pro: process.env.PAYPAL_PRO_PLAN_ID ?? "",
  };
  return ids[plan] ?? "";
}

/** Reverse mapping used to resolve which internal plan a PayPal plan ID represents. */
export function resolvePlanFromPayPalPlanId(planId: string): PlanName | null {
  if (!planId) return null;
  for (const plan of ["starter", "business", "pro"] as const) {
    if (getPayPalPlanId(plan) === planId) return plan;
  }
  return null;
}
