"use server";

import { revalidatePath } from "next/cache";

import type { z } from "zod";

import { extractTextFromFile } from "@/lib/ai/document-extractor";
import { embedText } from "@/lib/ai/embeddings";
import { crawlUrl } from "@/lib/ai/website-crawler";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { PERMISSIONS } from "@/lib/auth/roles";
import {
  addFaqSourceSchema,
  addTextSourceSchema,
  addWebsiteSourceSchema,
  deleteSourceSchema,
  getAgentSourcesSchema,
  reindexSourceSchema,
} from "@/lib/auth/schemas/knowledge.schema";
import { enforceDocumentLimit } from "@/lib/billing/usage-enforcement";
import { db } from "@/lib/db/client";
import * as knowledgeRepo from "@/lib/db/repositories/knowledge.repo";
import { chunkText, contentHash } from "@/lib/security/chunking";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import { assertPublicUrl } from "@/lib/security/upload-security";

export async function addWebsiteSource(data: z.infer<typeof addWebsiteSourceSchema>) {
  const parsed = addWebsiteSourceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const access = await requireWorkspaceAccess(parsed.data.workspaceId, PERMISSIONS.KNOWLEDGE_CREATE);

    const rateLimit = checkRateLimit(`crawl:${access.userId}`, 5, 60000);
    if (!rateLimit.allowed) {
      return { error: "Too many crawl requests. Please wait before trying again." };
    }

    const urlCheck = await assertPublicUrl(parsed.data.url);
    if (!urlCheck.allowed) {
      return { error: urlCheck.error };
    }

    const limitCheck = await enforceDocumentLimit(parsed.data.workspaceId);
    if (!limitCheck.allowed) {
      return { error: limitCheck.error ?? "Document limit reached." };
    }

    const source = await knowledgeRepo.createKnowledgeSource({
      workspace: parsed.data.workspaceId,
      agent: parsed.data.agentId,
      type: "website",
      title: new URL(parsed.data.url).hostname,
      url: parsed.data.url,
    });

    // Crawl the page, chunk the extracted text, and store each chunk with its
    // embedding so the agent can answer from the site content.
    try {
      await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "processing");
      const result = await crawlUrl(parsed.data.url);

      if (result.title) {
        await db.knowledgeSource.update(source.id, { title: result.title });
      }

      const written = await indexChunks({
        sourceId: source.id,
        chunks: result.chunks,
        metadata: {
          source: "website",
          title: result.title,
          url: parsed.data.url,
        },
      });
      await knowledgeRepo.updateChunkCount(source.id, written);
      await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "ready");
    } catch (error) {
      await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "failed", errorMessage(error));
      console.error("Failed to crawl website source:", error);
    }

    revalidatePath("/dashboard/agents");
    return { success: true, source };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to add website source:", error);
    return { error: "Failed to add website source. Please try again." };
  }
}

export async function addDocumentSource(formData: FormData, workspaceId: string, agentId?: string) {
  try {
    const access = await requireWorkspaceAccess(workspaceId, PERMISSIONS.KNOWLEDGE_CREATE);

    const rateLimit = checkRateLimit(`upload:${access.userId}`, 10, 60000);
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
      "text/markdown",
    ]);

    if (!allowedTypes.has(file.type)) {
      return { error: `File type "${file.type}" is not supported.` };
    }

    const limitCheck = await enforceDocumentLimit(workspaceId);
    if (!limitCheck.allowed) {
      return { error: limitCheck.error ?? "Document limit reached." };
    }

    const source = await knowledgeRepo.createKnowledgeSource({
      workspace: workspaceId,
      agent: agentId,
      type: "document",
      title: file.name,
    });

    try {
      await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "processing");
      const extracted = await extractTextFromFile(file);
      const chunks = chunkText(extracted, { splitOn: "paragraph" });

      const written = await indexChunks({
        sourceId: source.id,
        chunks,
        metadata: {
          source: "document",
          title: file.name,
          file_name: file.name,
        },
      });

      await knowledgeRepo.updateChunkCount(source.id, written);
      await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "ready");
    } catch (error) {
      await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "failed", errorMessage(error));
      console.error("Failed to process document source:", error);
    }

    revalidatePath("/dashboard/agents");
    return { success: true, source };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to add document source:", error);
    return { error: "Failed to add document. Please try again." };
  }
}

export async function addTextSource(data: z.infer<typeof addTextSourceSchema>) {
  const parsed = addTextSourceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await requireWorkspaceAccess(parsed.data.workspaceId, PERMISSIONS.KNOWLEDGE_CREATE);

    const limitCheck = await enforceDocumentLimit(parsed.data.workspaceId);
    if (!limitCheck.allowed) {
      return { error: limitCheck.error ?? "Document limit reached." };
    }

    const source = await knowledgeRepo.createKnowledgeSource({
      workspace: parsed.data.workspaceId,
      agent: parsed.data.agentId,
      type: "text",
      title: parsed.data.title,
    });

    const chunks = chunkText(parsed.data.content);

    // Store each chunk with its embedding so the agent can answer from this
    // content following its system prompt.
    try {
      await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "processing");
      const written = await indexChunks({
        sourceId: source.id,
        chunks,
        metadata: {
          source: "text",
          title: parsed.data.title,
        },
      });
      await knowledgeRepo.updateChunkCount(source.id, written);
      await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "ready");
    } catch (error) {
      await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "failed", errorMessage(error));
      console.error("Failed to embed text source:", error);
    }

    revalidatePath("/dashboard/agents");
    return { success: true, source };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to add text source:", error);
    return { error: "Failed to add text source. Please try again." };
  }
}

export async function addFaqSource(data: z.infer<typeof addFaqSourceSchema>) {
  const parsed = addFaqSourceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await requireWorkspaceAccess(parsed.data.workspaceId, PERMISSIONS.KNOWLEDGE_CREATE);

    const limitCheck = await enforceDocumentLimit(parsed.data.workspaceId);
    if (!limitCheck.allowed) {
      return { error: limitCheck.error ?? "Document limit reached." };
    }

    const source = await knowledgeRepo.createKnowledgeSource({
      workspace: parsed.data.workspaceId,
      agent: parsed.data.agentId,
      type: "faq",
      title: parsed.data.title,
    });

    const fullText = parsed.data.faqs.map((f) => `Question: ${f.question}\nAnswer: ${f.answer}`).join("\n\n");

    const chunks = parsed.data.faqs.map((faq, i) => ({
      content: `Question: ${faq.question}\nAnswer: ${faq.answer}`,
      index: i,
      metadata: { type: "faq" as const },
    }));

    // Store each FAQ chunk with its embedding so the agent can answer from it.
    try {
      await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "processing");
      const written = await indexChunks({
        sourceId: source.id,
        chunks,
        metadata: {
          source: "faq",
          title: parsed.data.title,
          full_text: fullText,
        },
      });
      await knowledgeRepo.updateChunkCount(source.id, written);
      await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "ready");
    } catch (error) {
      await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "failed", errorMessage(error));
      console.error("Failed to embed FAQ source:", error);
    }

    revalidatePath("/dashboard/agents");
    return { success: true, source };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to add FAQ source:", error);
    return { error: "Failed to add FAQ source. Please try again." };
  }
}

export async function deleteKnowledgeSource(data: z.infer<typeof deleteSourceSchema>) {
  const parsed = deleteSourceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const source = await knowledgeRepo.getKnowledgeSourceById(parsed.data.sourceId);
    if (!source) {
      return { error: "Knowledge source not found." };
    }
    await requireWorkspaceAccess(source.workspace, PERMISSIONS.KNOWLEDGE_DELETE);

    await knowledgeRepo.deleteKnowledgeSource(parsed.data.sourceId);
    revalidatePath("/dashboard/agents");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to delete knowledge source:", error);
    return { error: "Failed to delete knowledge source. Please try again." };
  }
}

/**
 * Reparse and re-embed a source. Existing chunks marked in the previous index
 * generation are removed so stale vectors never linger after content changes.
 */
export async function reindexKnowledgeSource(data: z.infer<typeof reindexSourceSchema>) {
  const parsed = reindexSourceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const source = await knowledgeRepo.getKnowledgeSourceById(parsed.data.sourceId);
    if (!source) {
      return { error: "Knowledge source not found." };
    }
    await requireWorkspaceAccess(source.workspace, PERMISSIONS.KNOWLEDGE_UPDATE);

    await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "processing");

    let chunks: { content: string; index: number; metadata?: Record<string, unknown> }[];
    let metadata: Record<string, unknown>;

    if (source.type === "website" && source.url) {
      const result = await crawlUrl(source.url);
      if (result.title) {
        await db.knowledgeSource.update(source.id, { title: result.title });
      }
      chunks = result.chunks;
      metadata = { source: "website", title: result.title, url: source.url };
    } else {
      // Document, text, and FAQ sources are re-indexed from their stored
      // chunks, which retain the parsed text after the original doc is gone.
      const stored = await db.knowledgeChunk.getBySource(source.id);
      chunks = stored.map((chunk) => ({
        content: chunk.content,
        index: chunk.index,
        metadata: chunk.metadata,
      }));
      metadata = { source: source.type };
    }

    // Replace the previous generation of vectors atomically-ish: delete stale
    // chunks first, then write the freshly embedded ones.
    await db.knowledgeChunk.deleteBySource(source.id);
    const written = await indexChunks({ sourceId: source.id, chunks, metadata });
    await knowledgeRepo.updateChunkCount(source.id, written);
    await knowledgeRepo.updateKnowledgeSourceStatus(source.id, "ready");

    revalidatePath("/dashboard/agents");
    return { success: true, written };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to reindex knowledge source:", error);
    if (parsed.data.sourceId) {
      await knowledgeRepo.updateKnowledgeSourceStatus(parsed.data.sourceId, "failed", message).catch(() => undefined);
    }
    return { error: "Failed to reindex knowledge source. Please try again." };
  }
}

/**
 * Shared ingest step: embed every chunk, deduplicate by content hash, and
 * persist to Directus. Returns the number of chunks newly written.
 */
async function indexChunks(params: {
  sourceId: string;
  chunks: Array<{ content: string; index: number; metadata?: Record<string, unknown> }>;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  let written = 0;

  for (const chunk of params.chunks) {
    const hash = contentHash(chunk.content);

    const existing = await db.knowledgeChunk.getMany({
      filter: { source: { _eq: params.sourceId }, content_hash: { _eq: hash } },
      limit: 1,
      fields: ["id"],
    });

    if (existing.length > 0) {
      continue;
    }

    const tokens = estimateTokens(chunk.content);
    const { embedding } = await embedText(chunk.content);

    await db.knowledgeChunk.create({
      source: params.sourceId,
      content: chunk.content,
      embedding,
      metadata: { ...params.metadata, ...chunk.metadata },
      index: chunk.index,
      content_hash: hash,
      token_count: tokens,
    });
    written += 1;
  }

  return written;
}

/** Rough heuristic: ~4 characters per token, plus a ceiling for controls. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message.slice(0, 500) : undefined;
}

export async function getAgentKnowledgeSources(data: z.infer<typeof getAgentSourcesSchema>) {
  const parsed = getAgentSourcesSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, sources: [] };
  }

  try {
    await requireWorkspaceAccess(parsed.data.workspaceId, PERMISSIONS.KNOWLEDGE_READ);
    const sources = await knowledgeRepo.getAgentKnowledgeSources(parsed.data.agentId);
    return { success: true, sources };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message, sources: [] };
    }
    console.error("Failed to fetch knowledge sources:", error);
    return { error: "Failed to load knowledge sources.", sources: [] };
  }
}
