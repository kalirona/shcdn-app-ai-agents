import { db } from "../client";
import type { WorkspaceEntity } from "../entities";

export interface SubscriptionFields {
  plan: WorkspaceEntity["plan"];
  status: WorkspaceEntity["subscription_status"];
  paymentProvider: string | null;
  paymentProviderSubscriptionId: string | null;
  paymentProviderCustomerId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Resolves the workspace that owns a given provider subscription ID.
 *
 * This is the authoritative server-side mapping used by inbound webhooks:
 *   PayPal subscription ID -> Agent AI workspace.
 * The browser never supplies the workspace for a webhook.
 */
export async function getWorkspaceByProviderSubscriptionId(
  provider: string,
  providerSubscriptionId: string,
): Promise<WorkspaceEntity | null> {
  const workspaces = await db.workspace.getMany({
    filter: {
      payment_provider: { _eq: provider },
      payment_provider_subscription_id: { _eq: providerSubscriptionId },
    },
    limit: 1,
  });
  return workspaces[0] ?? null;
}

export async function getSubscriptionByWorkspace(workspaceId: string): Promise<SubscriptionFields | null> {
  const workspace = await db.workspace.getById(workspaceId);
  if (!workspace) return null;

  return {
    plan: workspace.plan,
    status: workspace.subscription_status,
    paymentProvider: workspace.payment_provider,
    paymentProviderSubscriptionId: workspace.payment_provider_subscription_id,
    paymentProviderCustomerId: workspace.payment_provider_customer_id,
    currentPeriodStart: workspace.current_period_start,
    currentPeriodEnd: workspace.current_period_end,
    cancelAtPeriodEnd: workspace.cancel_at_period_end,
  };
}

export async function updateSubscription(workspaceId: string, data: Partial<SubscriptionFields>) {
  await db.workspace.update(workspaceId, {
    plan: data.plan,
    subscription_status: data.status,
    payment_provider: data.paymentProvider ?? null,
    payment_provider_subscription_id: data.paymentProviderSubscriptionId ?? null,
    payment_provider_customer_id: data.paymentProviderCustomerId ?? null,
    current_period_start: data.currentPeriodStart ?? null,
    current_period_end: data.currentPeriodEnd ?? null,
    cancel_at_period_end: data.cancelAtPeriodEnd ?? false,
  });
}
