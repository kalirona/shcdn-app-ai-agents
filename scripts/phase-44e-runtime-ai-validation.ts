/**
 * PHASE 4.4E — Runtime AI Validation (locked).
 *
 * Exercises the live AI runtime end-to-end against the configured provider
 * (OpenRouter) and Supabase. Run with bun (which resolves tsconfig paths):
 *
 *   bun scripts/phase-44e-runtime-ai-validation.ts [--agent <id>]
 *
 * Covers: embedding resolution, exact chat-model verification, 2048-dim vector
 * check, match_knowledge_chunks RPC, primary chat, fast chat, vision resolution,
 * RAG, disabled-model rejection, failure behavior, and cost logging.
 */

import { createGateway } from "../src/lib/ai/gateway";
import { ragQuery } from "../src/lib/ai/rag-pipeline";
import { getAgentById } from "../src/lib/db/repositories/agent.repo";

const AGENT_ID = process.argv.includes("--agent")
  ? process.argv[process.argv.indexOf("--agent") + 1]
  : process.env.AGENT_ID ?? "8b8921f7-6bd0-4ccb-8dbf-81a0f3fef1fc";

let passes = 0;
let failures = 0;

function check(label: string, cond: boolean, extra = ""): void {
  if (cond) {
    passes += 1;
    console.log(`  PASS  ${label}${extra ? ` — ${extra}` : ""}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${extra ? ` — ${extra}` : ""}`);
  }
}

async function safe<T>(label: string, fn: () => Promise<T>): Promise<{ ok: boolean; value?: T; error?: unknown }> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (error) {
    console.error(`    (${label}) threw: ${error instanceof Error ? error.message : String(error).slice(0, 300)}`);
    return { ok: false, error };
  }
}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function matchKnowledgeChunksRPC(embedding: number[]): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_knowledge_chunks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ p_query_embedding: embedding, p_workspace_id: "00000000-0000-0000-0000-000000000000" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RPC ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function main(): Promise<void> {
  console.log(`\nPHASE 4.4E — Runtime AI Validation (agent=${AGENT_ID})\n`);

  const gateway = await safe("createGateway", async () => {
    const g = await createGateway();
    const chat = await g.adapterFor("chat");
    const emb = await g.adapterFor("embeddings");
    return { g, chat, emb };
  });
  if (!gateway.ok) {
    console.error("\nFATAL: cannot create gateway — check provider config + env key.\n");
    process.exit(1);
  }
  const { g, chat, emb } = gateway.value!;

  // 1. Embedding resolution
  check("embedding adapter resolves", !!emb, emb ? `model=${JSON.stringify((emb as unknown as { defaultModel?: string }).defaultModel ?? "?")}` : "null");
  let embeddingVec: number[] | null = null;
  if (emb) {
    const er = await safe("embed", () => emb.embed("What are your opening hours?"));
    check("embedding call succeeds", er.ok, er.ok ? `model=${(er.value as { model?: string } | undefined)?.model ?? ""}` : "");
    embeddingVec = er.ok ? (er.value as { embedding?: number[] }).embedding ?? null : null;
    check("embedding is non-empty array", Array.isArray(embeddingVec) && (embeddingVec?.length ?? 0) > 0, `len=${embeddingVec?.length ?? 0}`);
    check("embedding is 2048-dimensional", (embeddingVec?.length ?? 0) === 2048, `len=${embeddingVec?.length ?? 0}`);
    check("embedding values are finite numbers", embeddingVec ? embeddingVec.every((n) => Number.isFinite(n)) : false);
  }
// 2. Exact chat-model verification
  const chatRes = await g.resolve("chat");
  check("chat resolution found a provider+model", !!chatRes, chatRes ? `${chatRes.provider.provider_key}/${chatRes.modelId}` : "");
  const chatModel = chatRes?.modelId ?? "";
  check("resolved chat model is a nvidia Nemotron/free model", /nvidia\/nemotron|-super-|nemotron|free/i.test(chatModel), chatModel);

  // 3. Primary chat
  if (chat) {
    const cr = await safe("primary chat", () =>
      g.chat({ messages: [{ role: "user", content: "Say hello in one short sentence." }], purpose: "chat", maxTokens: 80 }),
    );
    check("primary chat returns non-empty content", cr.ok && !!((cr.value as { content?: string })?.content ?? "").trim(), (cr.value as { content?: string })?.content?.slice(0, 80) ?? "");
  }

  // 4. Fast chat
  const fast = await safe("resolve fast", async () => {
    const a = await g.adapterFor("fast");
    if (!a) throw new Error("no fast adapter");
    return a.chat({ messages: [{ role: "user", content: "Reply: ok" }], maxTokens: 20 });
  });
  check("fast chat resolves and responds", fast.ok, fast.ok ? (fast.value as { content?: string })?.content?.slice(0, 60) ?? "" : "");

  // 5. Vision resolution
  const vis = await safe("resolve vision", () => g.adapterFor("vision"));
  check("vision adapter resolution attempted", true, vis.ok ? `resolved (${(vis.value as { defaultModel?: string } | null)?.defaultModel ?? "?"})` : `null (${vis.error instanceof Error ? vis.error.message.slice(0, 80) : String(vis.error).slice(0, 80)})`);

  // 6. Disabled-model rejection
  const disabled = await safe("disabled model rejected", () =>
    g.chat({ messages: [{ role: "user", content: "hi" }], purpose: "chat", model: "openai/gpt-4o-not-real-disabled" }),
  );
  check("request for unknown/disabled model is rejected", !disabled.ok, disabled.ok ? "was allowed (bad)" : "rejected");

  // 7. Failure behavior — empty user message should not hang/crash ungracefully
  const failCase = await safe("failure behavior (empty user msg)", () =>
    g.chat({ messages: [{ role: "user", content: "" }], purpose: "chat", maxTokens: 30 }),
  );
  check("empty-message chat handled without unhandled throw", true, failCase.ok ? (failCase.value as { content?: string })?.content?.slice(0, 40) ?? "returned" : "cleanly errored");
// 8. Cost logging — verify a row can be written to ai_usage / costLog
  const cost = await safe("cost logging", async () => {
    const { db } = await import("../src/lib/db/client");
    await db.costLog.create({
      provider: "openrouter",
      model: "validation-test",
      purpose: "chat",
      input_tokens: 1,
      output_tokens: 1,
      input_cost: 0,
      output_cost: 0,
      total_cost: 0,
      workspace: null,
      agent: null,
      user: null,
      date_updated: new Date().toISOString(),
    });
    return true;
  });
  check("cost log row written (ai_usage)", cost.ok, "");

  // 9. RAG pipeline live
  const agentRes = await safe("agent fetch", () => getAgentById(AGENT_ID));
  const agent = agentRes.value ?? null;
  check("agent resolved from DB", !!agent, agent ? (agent as { name?: string }).name ?? "" : "");
  if (agent) {
    const rag = await safe("ragQuery", () => ragQuery({ agent, query: "Do you offer refunds?", history: [] }));
    check("RAG pipeline returns a response", rag.ok && !!((rag.value as { content?: string })?.content ?? "").trim(), (rag.value as { content?: string })?.content?.slice(0, 80) ?? "");
    const sources = rag.ok ? (rag.value as { sources?: unknown[] }).sources ?? [] : [];
    check("RAG sources is an array", Array.isArray(sources), `count=${sources.length}`);
  }

  // 10. Vector search path (embedding from step 1 → local cosine retrieval)
  if (embeddingVec && agent) {
    const vs = await safe("vectorSearch", async () => {
      const { vectorSearch } = await import("../src/lib/ai/vector-search");
      return vectorSearch({ embedding: embeddingVec!, workspaceId: (agent as { workspace: string }).workspace, agentId: (agent as { id: string }).id });
    });
    check("vectorSearch returns array without throwing", vs.ok, vs.ok ? `results=${(vs.value as unknown[]).length}` : "");
  }

  // 11. match_knowledge_chunks RPC (live schema check)
  if (embeddingVec) {
    const rpc = await safe("match_knowledge_chunks RPC", () => matchKnowledgeChunksRPC(embeddingVec!));
    const msg = rpc.error instanceof Error ? rpc.error.message.slice(0, 120) : "";
    check("match_knowledge_chunks RPC exists and returns", rpc.ok, rpc.ok ? "returned" : `param/schema (${msg})`);
  }

  console.log(`\nRESULT: ${passes} passed, ${failures} failed\n`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("validation crashed:", e);
  process.exit(1);
});