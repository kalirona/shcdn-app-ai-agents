import type { WebhookEntity, WebhookEventName } from "@/lib/db/entities";
import * as webhookRepo from "@/lib/db/repositories/webhook.repo";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Headers set on every outbound webhook delivery. */
export const WEBHOOK_SIGNATURE_HEADER = "X-AgentAI-Signature";
export const WEBHOOK_TIMESTAMP_HEADER = "X-AgentAI-Timestamp";

interface DeliverResult {
  success: boolean;
  httpStatus: number | null;
  responseTime: number;
  retries: number;
}

/** Generates a new random signing secret (hex, 32 bytes). */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Computes the HMAC-SHA256 signature for a payload.
 * Signature covers `${timestamp}.${payload}` so the timestamp cannot be
 * swapped without invalidating the signature.
 */
export function signWebhookPayload(secret: string, timestamp: string, payload: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

/** Constant-time comparison of an incoming signature against the expected hex digest. */
export function verifyWebhookSignature(secret: string, timestamp: string, payload: string, signature: string): boolean {
  const expected = signWebhookPayload(secret, timestamp, payload);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

async function postToEndpoint(webhook: WebhookEntity, payload: Record<string, unknown>): Promise<DeliverResult> {
  const started = Date.now();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify(payload, null, 2);
  const secret = webhook.secret ?? "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "AgentAI-Webhook/1.0",
  };
  if (secret) {
    headers[WEBHOOK_SIGNATURE_HEADER] = signWebhookPayload(secret, timestamp, body);
    headers[WEBHOOK_TIMESTAMP_HEADER] = timestamp;
  }

  let response: Response;
  try {
    response = await fetch(webhook.endpoint_url, {
      method: "POST",
      headers,
      body,
      // Never follow redirects to an external endpoint we don't control.
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { success: false, httpStatus: null, responseTime: Date.now() - started, retries: 0 };
  }

  return {
    success: response.ok,
    httpStatus: response.status,
    responseTime: Date.now() - started,
    retries: 0,
  };
}

/**
 * Delivers `event` to every active webhook subscribed to it in the workspace.
 * Each delivery is recorded as a webhook_deliveries row. A failed delivery is
 * retried once; the retry is reflected in retry_count.
 */
export async function dispatchWebhook(workspaceId: string, event: WebhookEventName, payload: Record<string, unknown>) {
  const webhooks = await webhookRepo.getWebhooksByWorkspace(workspaceId);
  const targets = webhooks.filter((w) => w.active !== false && w.events.includes(event));

  await Promise.all(
    targets.map(async (webhook) => {
      try {
        const result = await postToEndpoint(webhook, {
          event,
          timestamp: new Date().toISOString(),
          attempt: 1,
          data: payload,
        });

        if (!result.success) {
          // One quick retry after a short backoff.
          await new Promise((resolve) => setTimeout(resolve, 500));
          const retry = await postToEndpoint(webhook, {
            event,
            timestamp: new Date().toISOString(),
            attempt: 2,
            data: payload,
          });

          await webhookRepo.recordWebhookDelivery({
            webhook: webhook.id,
            event,
            status: retry.success ? "success" : "failed",
            http_status: retry.httpStatus,
            response_time: retry.responseTime,
            retry_count: 1,
          });
          return;
        }

        await webhookRepo.recordWebhookDelivery({
          webhook: webhook.id,
          event,
          status: "success",
          http_status: result.httpStatus,
          response_time: result.responseTime,
          retry_count: 0,
        });
      } catch {
        // Webhook dispatch must never break the primary flow (lead save, etc).
        await webhookRepo
          .recordWebhookDelivery({
            webhook: webhook.id,
            event,
            status: "failed",
            http_status: null,
            response_time: 0,
            retry_count: 0,
          })
          .catch(() => undefined);
      }
    }),
  );
}

/** Sends a manual test event; does not record a delivery row. Respects the webhook's configured endpoint. */
export async function sendTestWebhook(webhook: WebhookEntity): Promise<DeliverResult> {
  const payload: Record<string, unknown> = {
    event: "test.ping",
    timestamp: new Date().toISOString(),
    data: { message: "This is a test event from Agent AI." },
  };
  return postToEndpoint(webhook, payload);
}
