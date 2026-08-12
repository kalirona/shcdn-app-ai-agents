import { db } from "../client";
import type { WebhookEventEntity } from "../entities";

export interface RecordWebhookEventParams {
  eventId: string;
  provider: string;
  eventType: string;
  subscriptionId: string | null;
  workspaceId: string | null;
  status: "processed" | "failed";
}

/**
 * Returns true if a provider webhook event with this ID has already been
 * recorded (processed) for this provider. Used to enforce idempotency so a
 * duplicate PayPal delivery is never applied twice.
 */
export async function isWebhookEventProcessed(provider: string, eventId: string): Promise<boolean> {
  const rows = await db.webhookEvent.getByEventId(provider, eventId);
  return rows.length > 0;
}

/** Records an inbound provider webhook event in the idempotency ledger. */
export async function recordWebhookEvent(params: RecordWebhookEventParams): Promise<WebhookEventEntity> {
  return db.webhookEvent.create({
    event_id: params.eventId,
    provider: params.provider,
    event_type: params.eventType,
    subscription_id: params.subscriptionId,
    workspace: params.workspaceId,
    status: params.status,
  });
}