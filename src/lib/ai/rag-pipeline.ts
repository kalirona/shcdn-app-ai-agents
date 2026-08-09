import type { AgentEntity } from "@/lib/db/entities";

import { type AIMessage, type AIProvider, createAIProvider } from "./provider";
import { type SearchResult, vectorSearch } from "./vector-search";

export interface RagContext {
  agent: AgentEntity;
  query: string;
  history: AIMessage[];
  conversationId?: string;
}

export interface RagResult {
  content: string;
  sources: Array<{
    title: string | null;
    url: string | null;
    chunkId: string;
  }>;
  confidence: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface RagStreamChunk {
  content: string;
  done: boolean;
  sources?: RagResult["sources"];
  usage?: RagResult["usage"];
}

const PROVIDER: AIProvider = (process.env.AI_PROVIDER as AIProvider) ?? "openai";

const provider = createAIProvider(PROVIDER);

export async function ragQuery(context: RagContext): Promise<RagResult> {
  const embedding = await provider.embed(context.query);

  const searchResults = await vectorSearch({
    embedding: embedding.embedding,
    workspaceId: context.agent.workspace,
    agentId: context.agent.id,
    limit: 5,
    threshold: 0.7,
  });

  if (searchResults.length === 0) {
    return {
      content: context.agent.fallback_message,
      sources: [],
      confidence: 0,
    };
  }

  const systemPrompt = buildSystemPrompt(context.agent, searchResults);
  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    ...context.history,
    { role: "user", content: context.query },
  ];

  const response = await provider.chat({
    messages,
    temperature: 0.3,
    maxTokens: 500,
  });

  const confidence = calculateConfidence(searchResults);

  return {
    content: response.content,
    sources: searchResults.map((r) => ({
      title: r.sourceTitle,
      url: r.sourceUrl,
      chunkId: r.id,
    })),
    confidence,
    usage: response.usage,
  };
}

export async function* ragStreamQuery(context: RagContext): AsyncGenerator<RagStreamChunk> {
  const embedding = await provider.embed(context.query);

  const searchResults = await vectorSearch({
    embedding: embedding.embedding,
    workspaceId: context.agent.workspace,
    agentId: context.agent.id,
    limit: 5,
    threshold: 0.7,
  });

  if (searchResults.length === 0) {
    yield {
      content: context.agent.fallback_message,
      done: true,
      sources: [],
    };
    return;
  }

  const systemPrompt = buildSystemPrompt(context.agent, searchResults);
  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    ...context.history,
    { role: "user", content: context.query },
  ];

  let _fullContent = "";

  for await (const chunk of provider.streamChat({
    messages,
    temperature: 0.3,
    maxTokens: 500,
  })) {
    _fullContent += chunk.content;
    yield {
      content: chunk.content,
      done: chunk.done,
    };
  }

  const _confidence = calculateConfidence(searchResults);

  yield {
    content: "",
    done: true,
    sources: searchResults.map((r) => ({
      title: r.sourceTitle,
      url: r.sourceUrl,
      chunkId: r.id,
    })),
  };
}

function buildSystemPrompt(agent: AgentEntity, searchResults: SearchResult[]): string {
  const contextSections = searchResults
    .map((result, i) => {
      const sourceLabel = result.sourceTitle ? `Source: ${result.sourceTitle}\n` : "";
      return `[Source ${i + 1}]\n${sourceLabel}${result.content}`;
    })
    .join("\n\n");

  return `${agent.system_prompt ?? getDefaultSystemPrompt(agent)}

LANGUAGE: ${agent.language}

## Available Knowledge Base

The following information has been found in the knowledge base. Use ONLY this information to answer the user's question. If the answer is not in the knowledge base, say so honestly.

${contextSections}

## Rules
- Answer ONLY based on the provided knowledge base.
- Be concise and helpful (2-3 sentences unless more detail is needed).
- If the answer is not in the knowledge base, politely say you don't know and offer to connect them with a human.
- NEVER make up information, policies, or prices.
- Cite sources when possible using [Source N] format.
- Match the ${agent.tone} tone specified.`;
}

function getDefaultSystemPrompt(agent: AgentEntity): string {
  return `You are ${agent.name}, an AI assistant for this business.`;
}

function calculateConfidence(searchResults: SearchResult[]): number {
  if (searchResults.length === 0) return 0;
  const avgSimilarity = searchResults.reduce((sum, r) => sum + r.similarity, 0) / searchResults.length;
  return Math.min(avgSimilarity, 1);
}
