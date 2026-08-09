import { db } from "../client";
import type { KnowledgeSourceEntity } from "../entities";

export interface CreateKnowledgeSourceParams {
  workspace: string;
  agent?: string;
  type: "website" | "document" | "faq" | "text";
  title: string;
  url?: string;
  file?: string;
}

export async function createKnowledgeSource(params: CreateKnowledgeSourceParams): Promise<KnowledgeSourceEntity> {
  return db.knowledgeSource.create({
    workspace: params.workspace,
    agent: params.agent ?? null,
    type: params.type,
    title: params.title,
    url: params.url ?? null,
    file: params.file ?? null,
    error_message: null,
  });
}

export async function getAgentKnowledgeSources(agentId: string): Promise<KnowledgeSourceEntity[]> {
  return db.knowledgeSource.getByAgent(agentId);
}

export async function getWorkspaceKnowledgeSources(workspaceId: string): Promise<KnowledgeSourceEntity[]> {
  return db.knowledgeSource.getByWorkspace(workspaceId);
}

export async function updateKnowledgeSourceStatus(
  id: string,
  status: "pending" | "processing" | "ready" | "failed",
  errorMessage?: string,
): Promise<KnowledgeSourceEntity> {
  return db.knowledgeSource.update(id, {
    status,
    error_message: errorMessage ?? null,
  });
}

export async function updateChunkCount(id: string, count: number): Promise<KnowledgeSourceEntity> {
  return db.knowledgeSource.update(id, { chunk_count: count });
}

export async function deleteKnowledgeSource(id: string): Promise<void> {
  await db.knowledgeChunk.deleteBySource(id);
  await db.knowledgeSource.delete(id);
}
