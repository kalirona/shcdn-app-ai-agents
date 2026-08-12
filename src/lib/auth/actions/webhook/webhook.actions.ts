"use server";

import { revalidatePath } from "next/cache";

import type { z } from "zod";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { PERMISSIONS } from "@/lib/auth/roles";
import { createWebhookSchema, updateWebhookSchema, webhookIdSchema } from "@/lib/auth/schemas/webhook.schema";
import * as webhookRepo from "@/lib/db/repositories/webhook.repo";
import { generateWebhookSecret, sendTestWebhook } from "@/lib/webhooks/delivery";

export async function getWorkspaceWebhooks(workspaceId: string) {
  try {
    await requireWorkspaceAccess(workspaceId, PERMISSIONS.SETTINGS_UPDATE);
    const webhooks = await webhookRepo.getWebhooksByWorkspace(workspaceId);
    return { success: true, webhooks };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message, webhooks: [] };
    }
    console.error("Failed to fetch webhooks:", error);
    return { error: "Failed to load webhooks.", webhooks: [] };
  }
}

export async function createWorkspaceWebhook(workspaceId: string, data: z.infer<typeof createWebhookSchema>) {
  const parsed = createWebhookSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await requireWorkspaceAccess(workspaceId, PERMISSIONS.SETTINGS_UPDATE);

    const webhook = await webhookRepo.createWebhook({
      workspace: workspaceId,
      name: parsed.data.name,
      endpointUrl: parsed.data.endpointUrl,
      events: parsed.data.events,
      secret: generateWebhookSecret(),
    });

    revalidatePath("/dashboard/settings");
    return { success: true, webhook };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to create webhook:", error);
    return { error: "Failed to create webhook. Please try again." };
  }
}

export async function updateWorkspaceWebhook(webhookId: string, data: z.infer<typeof updateWebhookSchema>) {
  const parsed = updateWebhookSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const webhook = await webhookRepo.getWebhookById(webhookId);
    if (!webhook) {
      return { error: "Webhook not found." };
    }
    await requireWorkspaceAccess(webhook.workspace, PERMISSIONS.SETTINGS_UPDATE);

    const updated = await webhookRepo.updateWebhook(webhookId, {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.endpointUrl !== undefined ? { endpoint_url: parsed.data.endpointUrl } : {}),
      ...(parsed.data.events !== undefined ? { events: parsed.data.events } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
    });

    revalidatePath("/dashboard/settings");
    return { success: true, webhook: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to update webhook:", error);
    return { error: "Failed to update webhook. Please try again." };
  }
}

export async function deleteWorkspaceWebhook(webhookId: string) {
  const parsed = webhookIdSchema.safeParse({ webhookId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const webhook = await webhookRepo.getWebhookById(webhookId);
    if (!webhook) {
      return { error: "Webhook not found." };
    }
    await requireWorkspaceAccess(webhook.workspace, PERMISSIONS.SETTINGS_UPDATE);

    await webhookRepo.deleteWebhook(webhookId);
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to delete webhook:", error);
    return { error: "Failed to delete webhook. Please try again." };
  }
}

export async function testWorkspaceWebhook(webhookId: string) {
  const parsed = webhookIdSchema.safeParse({ webhookId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const webhook = await webhookRepo.getWebhookById(webhookId);
    if (!webhook) {
      return { error: "Webhook not found." };
    }
    await requireWorkspaceAccess(webhook.workspace, PERMISSIONS.SETTINGS_UPDATE);

    const result = await sendTestWebhook(webhook);
    if (!result.success) {
      return {
        error: `Test delivery failed${result.httpStatus ? ` with HTTP ${result.httpStatus}` : " (no response)"}.`,
      };
    }
    return { success: true, httpStatus: result.httpStatus, responseTime: result.responseTime };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to test webhook:", error);
    return { error: "Failed to test webhook. Please try again." };
  }
}

export async function getWebhookDeliveries(webhookId: string) {
  try {
    const webhook = await webhookRepo.getWebhookById(webhookId);
    if (!webhook) {
      return { error: "Webhook not found.", deliveries: [] };
    }
    await requireWorkspaceAccess(webhook.workspace, PERMISSIONS.SETTINGS_UPDATE);

    const deliveries = await webhookRepo.getWebhookDeliveries(webhookId);
    return { success: true, deliveries };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message, deliveries: [] };
    }
    console.error("Failed to fetch deliveries:", error);
    return { error: "Failed to load delivery history.", deliveries: [] };
  }
}

/** Regenerates the signing secret for an existing webhook. */
export async function regenerateWebhookSecret(webhookId: string) {
  const parsed = webhookIdSchema.safeParse({ webhookId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const webhook = await webhookRepo.getWebhookById(webhookId);
    if (!webhook) {
      return { error: "Webhook not found." };
    }
    await requireWorkspaceAccess(webhook.workspace, PERMISSIONS.SETTINGS_UPDATE);

    const secret = generateWebhookSecret();
    await webhookRepo.updateWebhook(webhookId, { secret });
    return { success: true, secret };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to regenerate secret:", error);
    return { error: "Failed to regenerate secret. Please try again." };
  }
}
