import { db } from "../client";
import type { WebhookDeliveryEntity, WebhookEntity, WebhookEventName } from "../entities";

export interface CreateWebhookParams {
  workspace: string;
  name: string;
  endpointUrl: string;
  events: WebhookEventName[];
  secret?: string;
}

export async function createWebhook(params: CreateWebhookParams): Promise<WebhookEntity> {
  return db.webhook.create({
    workspace: params.workspace,
    name: params.name,
    endpoint_url: params.endpointUrl,
    events: params.events,
    secret: params.secret ?? null,
  });
}

export async function getWebhooksByWorkspace(workspaceId: string): Promise<WebhookEntity[]> {
  return db.webhook.getByWorkspace(workspaceId);
}

export async function getWebhookById(id: string): Promise<WebhookEntity | null> {
  try {
    return await db.webhook.getById(id);
  } catch {
    return null;
  }
}

export async function updateWebhook(id: string, data: Partial<WebhookEntity>): Promise<WebhookEntity> {
  return db.webhook.update(id, data);
}

export async function deleteWebhook(id: string): Promise<void> {
  await db.webhook.delete(id);
}

export async function getWebhookDeliveries(webhookId: string, limit = 20): Promise<WebhookDeliveryEntity[]> {
  return db.webhookDelivery.getByWebhook(webhookId).then((rows) => rows.slice(0, limit));
}

export async function recordWebhookDelivery(
  data: Omit<WebhookDeliveryEntity, "id" | "date_created" | "date_updated">,
): Promise<WebhookDeliveryEntity> {
  return db.webhookDelivery.create(data);
}
