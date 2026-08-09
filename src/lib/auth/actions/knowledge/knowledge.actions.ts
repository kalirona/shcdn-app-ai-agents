"use server";

import { revalidatePath } from "next/cache";

import type { z } from "zod";

import { getAuthContext } from "@/lib/auth/auth-context";
import {
  addFaqSourceSchema,
  addTextSourceSchema,
  addWebsiteSourceSchema,
  deleteSourceSchema,
} from "@/lib/auth/schemas/knowledge.schema";
import * as knowledgeRepo from "@/lib/db/repositories/knowledge.repo";
import { chunkText } from "@/lib/security/chunking";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import { isAllowedUrl } from "@/lib/security/upload-security";

async function requireAuth() {
  const { isAuthenticated, user } = await getAuthContext();
  if (!isAuthenticated || !user) {
    throw new Error("Unauthorized: You must be logged in.");
  }
  return user;
}

export async function addWebsiteSource(data: z.infer<typeof addWebsiteSourceSchema>) {
  const user = await requireAuth();

  const parsed = addWebsiteSourceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const rateLimit = checkRateLimit(`crawl:${user.id}`, 5, 60000);
  if (!rateLimit.allowed) {
    return { error: "Too many crawl requests. Please wait before trying again." };
  }

  const urlCheck = isAllowedUrl(parsed.data.url);
  if (!urlCheck.allowed) {
    return { error: urlCheck.error };
  }

  try {
    const source = await knowledgeRepo.createKnowledgeSource({
      workspace: "placeholder-workspace-id",
      agent: parsed.data.agentId,
      type: "website",
      title: new URL(parsed.data.url).hostname,
      url: parsed.data.url,
    });

    revalidatePath("/dashboard/agents");
    return { success: true, source };
  } catch (error) {
    console.error("Failed to add website source:", error);
    return { error: "Failed to add website source. Please try again." };
  }
}

export async function addDocumentSource(formData: FormData, workspaceId: string, agentId?: string) {
  const user = await requireAuth();

  const rateLimit = checkRateLimit(`upload:${user.id}`, 10, 60000);
  if (!rateLimit.allowed) {
    return { error: "Too many upload requests. Please wait before trying again." };
  }

  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return { error: "No file provided." };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { error: "File size exceeds 10MB limit." };
  }

  const allowedTypes = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
  ]);

  if (!allowedTypes.has(file.type)) {
    return { error: `File type "${file.type}" is not supported.` };
  }

  try {
    // TODO: Upload to R2, then process
    // For now, create the source record
    const source = await knowledgeRepo.createKnowledgeSource({
      workspace: workspaceId,
      agent: agentId,
      type: "document",
      title: file.name,
    });

    revalidatePath("/dashboard/agents");
    return { success: true, source };
  } catch (error) {
    console.error("Failed to add document source:", error);
    return { error: "Failed to add document. Please try again." };
  }
}

export async function addTextSource(data: z.infer<typeof addTextSourceSchema>) {
  const _user = await requireAuth();

  const parsed = addTextSourceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const source = await knowledgeRepo.createKnowledgeSource({
      workspace: "placeholder-workspace-id",
      agent: parsed.data.agentId,
      type: "text",
      title: parsed.data.title,
    });

    const chunks = chunkText(parsed.data.content);
    // TODO: Store chunks in Directus with embeddings

    await knowledgeRepo.updateChunkCount(source.id, chunks.length);

    revalidatePath("/dashboard/agents");
    return { success: true, source };
  } catch (error) {
    console.error("Failed to add text source:", error);
    return { error: "Failed to add text source. Please try again." };
  }
}

export async function addFaqSource(data: z.infer<typeof addFaqSourceSchema>) {
  const _user = await requireAuth();

  const parsed = addFaqSourceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const source = await knowledgeRepo.createKnowledgeSource({
      workspace: "placeholder-workspace-id",
      agent: parsed.data.agentId,
      type: "faq",
      title: parsed.data.title,
    });

    let _fullText = "";
    const chunks = [];

    for (const faq of parsed.data.faqs) {
      const qaText = `Question: ${faq.question}\nAnswer: ${faq.answer}`;
      _fullText += `${qaText}\n\n`;
      chunks.push({
        content: qaText,
        index: chunks.length,
        metadata: { type: "faq" },
      });
    }

    // TODO: Store chunks in Directus with embeddings
    await knowledgeRepo.updateChunkCount(source.id, chunks.length);

    revalidatePath("/dashboard/agents");
    return { success: true, source };
  } catch (error) {
    console.error("Failed to add FAQ source:", error);
    return { error: "Failed to add FAQ source. Please try again." };
  }
}

export async function deleteKnowledgeSource(data: z.infer<typeof deleteSourceSchema>) {
  const _user = await requireAuth();

  const parsed = deleteSourceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await knowledgeRepo.deleteKnowledgeSource(parsed.data.sourceId);
    revalidatePath("/dashboard/agents");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete knowledge source:", error);
    return { error: "Failed to delete knowledge source. Please try again." };
  }
}

export async function getAgentKnowledgeSources(agentId: string) {
  const _user = await requireAuth();

  try {
    const sources = await knowledgeRepo.getAgentKnowledgeSources(agentId);
    return { success: true, sources };
  } catch (error) {
    console.error("Failed to fetch knowledge sources:", error);
    return { error: "Failed to load knowledge sources.", sources: [] };
  }
}
