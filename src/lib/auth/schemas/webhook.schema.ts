import { z } from "zod";

import type { WebhookEventName } from "@/lib/db/entities";

export const WEBHOOK_EVENTS: WebhookEventName[] = [
  "conversation.created",
  "conversation.handoff",
  "lead.created",
  "booking.created",
  "booking.cancelled",
  "booking.rescheduled",
];

export const createWebhookSchema = z.object({
  name: z.string().trim().min(1, "Webhook name is required.").max(64, "Webhook name must be 64 characters or less."),
  endpointUrl: z
    .string()
    .trim()
    .url("Please enter a valid URL.")
    .max(2048, "Endpoint URL must be 2048 characters or less."),
  events: z
    .array(z.enum(WEBHOOK_EVENTS as [WebhookEventName, ...WebhookEventName[]]))
    .min(1, "Select at least one event.")
    .max(WEBHOOK_EVENTS.length, "Too many events selected."),
});

export const updateWebhookSchema = createWebhookSchema.partial().extend({
  active: z.boolean().optional(),
});

export const webhookIdSchema = z.object({
  webhookId: z.string().min(1, "Webhook ID is required."),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
