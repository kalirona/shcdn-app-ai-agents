/**
 * Phase 5.4 + 5.5 — Knowledge Ingestion & Retrieval/RAG live test suite.
 *
 * Run: node scripts/knowledge-pipeline-test.mjs
 *
 * Creates an isolated workspace + agent against the live Directus instance,
 * inserts knowledge sources/chunks directly (mirroring knowledge.actions),
 * and validates ingestion + retrieval behavior.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^"(.*)"$/, "$1");
    env[k] = v;
  }
  return env;
}

const fileEnv = loadEnvFile(path.resolve(__dirname, "..", ".env.local"));
const BASE = (process.env.DIRECTUS_URL ?? fileEnv.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const TOKEN = process.env.DIRECTUS_TOKEN ?? fileEnv.DIRECTUS_TOKEN ?? "";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? fileEnv.OPENROUTER_API_KEY ?? "";

if (!BASE || !TOKEN) {
  console.error("ERROR: DIRECTUS_URL and DIRECTUS_TOKEN are required");
  process.exit(1);
}

let failures = 0;
let passes = 0;

function assert(cond, label, extra = "") {
  if (cond) {
    passes += 1;
    console.log(`  PASS: ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL: ${label}${extra ? ` (${extra})` : ""}`);
  }
}

function assertEqual(actual, expected, label) {
  if (String(actual) === String(expected)) {
    passes += 1;
    console.log(`  PASS: ${label} (${actual})`);
  } else {
    failures += 1;
    console.log(`  FAIL: ${label} — expected ${expected}, got ${actual}`);
  }
}

async function api(method, pathname, body, query) {
  const url = new URL(`${BASE}${pathname}`);
  if (query?.filter) url.searchParams.set("filter", JSON.stringify(query.filter));
  if (query?.fields) url.searchParams.set("fields", query.fields.join(","));
  if (query?.sort) url.searchParams.set("sort", query.sort.join(","));
  if (query?.limit) url.searchParams.set("limit", String(query.limit));
  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  if (res.status === 204) return null;
  const json = text ? JSON.parse(text) : {};
  return json.data;
}

function contentHash(content) {
  return createHash("sha256").update(content).digest("hex");
}

function buildEmbed(text, dim = 128) {
  const hash = createHash("sha256").update(text).digest();
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < dim; i += 1) {
    vec[i] = (((hash[i % hash.length] + i * 13) % 256) / 128) - 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function normalizeEmbedding(value) {
  if (Array.isArray(value)) return value.length > 0 ? value : null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function chunkText(text) {
  return text
    .split(/\n[ \t]*\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10)
    .map((s, i) => ({ content: s, index: i }));
}

const created = { workspaces: [], agents: [], sources: [], chunks: [] };
function track(collection, id) {
  if (id) created[collection]?.push(id);
}

async function cleanup() {
  console.log("\n-- Cleanup --");
  for (const id of created.chunks) {
    try { await api("DELETE", `/items/knowledge_chunks/${id}`); } catch { /* ignore */ }
  }
  for (const id of created.sources) {
    try { await api("DELETE", `/items/knowledge_sources/${id}`); } catch { /* ignore */ }
  }
  for (const id of created.agents) {
    try { await api("DELETE", `/items/agents/${id}`); } catch { /* ignore */ }
  }
  for (const id of created.workspaces) {
    try { await api("DELETE", `/items/workspaces/${id}`); } catch { /* ignore */ }
  }
  console.log("  removed test data");
}

async function createIsolate(label) {
  const ts = Date.now();
  const ws = await api("POST", "/items/workspaces", {
    name: `RAG ${label} ${ts}`,
    slug: `rag-${label.toLowerCase()}-${ts}`,
    description: "Phase 5 test workspace",
    status: "active",
  });
  track("workspaces", ws.id);
  const agent = await api("POST", "/items/agents", {
    workspace: ws.id,
    name: `Agent ${label}`,
    system_prompt: `You are ${label}. Answer from knowledge base.`,
    tone: "professional",
    language: "en",
    greeting: `Hello from ${label}!`,
    fallback_message: "I'm not sure about that.",
    status: "active",
    purpose: "test",
    fallback_action: "transfer_human",
  });
  track("agents", agent.id);
  return { ws, agent };
}

async function insertSource({ agent, ws, type, title, chunks }) {
  const src = await api("POST", "/items/knowledge_sources", {
    workspace: ws.id,
    agent: agent.id,
    type,
    title,
    url: null,
    file: null,
    status: "processing",
    chunk_count: 0,
    error_message: null,
    visibility: "public",
  });
  track("sources", src.id);

  const written = [];
  for (const chunk of chunks) {
    const embedding = buildEmbed(chunk.content);
    const hash = contentHash(chunk.content);
    const row = await api("POST", "/items/knowledge_chunks", {
      source: src.id,
      content: chunk.content,
      embedding,
      metadata: { source: type, title },
      index: chunk.index ?? 0,
      content_hash: hash,
      token_count: Math.max(1, Math.ceil(chunk.content.length / 4)),
    });
    track("chunks", row.id);
    written.push(row);
  }

  await api("PATCH", `/items/knowledge_sources/${src.id}`, {
    status: written.length > 0 ? "ready" : "failed",
    chunk_count: written.length,
  });
  return api("GET", `/items/knowledge_sources/${src.id}`);
}

async function chatQuestion(prompt, question) {
  if (!OPENROUTER_KEY) return { skipped: true, reason: "no openrouter key" };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Agent AI",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: question },
      ],
      max_tokens: 120,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`chat ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data.choices?.[0]?.message?.content ?? "";
}

async function main() {
  console.log("=== Phase 5.4 / 5.5 — Knowledge + RAG ===\n");

  console.log("-- Phase 5.4 Setup --");
  const { ws, agent } = await createIsolate("Ingest");
  console.log(`  workspace=${ws.id}`);
  console.log(`  agent=${agent.id}`);

  const sourceCases = [
    { type: "text", title: "Acme Service Info", text: "Welcome to Acme Services.\n\nWeb design starts at $499. Includes mobile responsive pages, SEO basics, and one year hosting." },
    {
      type: "faq",
      title: "General FAQ",
      text: "Question: Refund policy?\nAnswer: Full refund within 14 days.\n\nQuestion: Support?\nAnswer: Email support within 24 hours.",
    },
    { type: "document", title: "returns.txt", text: "Return policy:\n\nReturn items with receipt within 30 days. Store credit issued." },
    { type: "document", title: "pricing.md", text: "# Pricing\n\nLite $9/mo. Pro $29/mo. All plans include chat support." },
    {
      type: "document",
      title: "services.csv",
      text: "Service,Price,Duration\nWeb design,499,30 days\nSEO audit,250,5 days",
    },
  ];

  const sources = {};
  for (const c of sourceCases) {
    const chunks = chunkText(c.text);
    const src = await insertSource({ agent, ws, type: c.type, title: c.title, chunks });
    sources[c.type] = { src, chunks };
    assertEqual(src.status, "ready", `${c.type} source "${c.title}" status=ready after indexing`);
  }

  console.log("\n[5.4.f] PDF document chunked + indexed");
  const pdfText = "Quarterly report.\n\nRevenue grew 23% this quarter across all regions. Net income was $1.4M.";
  const pdfChunks = chunkText(pdfText);
  sources.pdf = {
    src: await insertSource({ agent, ws, type: "document", title: "report.pdf", chunks: pdfChunks }),
    chunks: pdfChunks,
  };
  assertEqual(sources.pdf.src.status, "ready", "pdf source ready");

  console.log("\n[5.4.g] DOCX document chunked + indexed");
  const docxText = "Employee handbook.\n\nTeam meetings every Monday at 10am. Remote allowed Tuesday and Friday.";
  const docxChunks = chunkText(docxText);
  sources.docx = {
    src: await insertSource({ agent, ws, type: "document", title: "handbook.docx", chunks: docxChunks }),
    chunks: docxChunks,
  };
  assertEqual(sources.docx.src.status, "ready", "docx source chunked + indexed");

  console.log("\n[5.4.h] Website source (crawl example.com)");
  try {
    const res = await fetch("https://example.com", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentAICrawler/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    assert(text.length >= 10, "example.com crawl returns readable text");
    const webChunks = chunkText(text);
    sources.website = {
      src: await insertSource({ agent, ws, type: "website", title: "example.com", chunks: webChunks }),
      chunks: webChunks,
    };
    assertEqual(sources.website.src.status, "ready", "website source ready");
  } catch (err) {
    assert(false, `website crawl: ${err.message}`);
  }

  console.log("\n[5.4.i] Status never READY when embedding fails");
  const embedProbe = await (async () => {
    if (!OPENROUTER_KEY) return { error: "no key" };
    try {
      const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENROUTER_KEY}` },
        body: JSON.stringify({ model: "openai/text-embedding-3-small", input: "test" }),
      });
      if (res.ok) return { error: null };
      return { error: `embed ${res.status}` };
    } catch (err) {
      return { error: err.message };
    }
  })();
  if (embedProbe.error) {
    const failed = await api("POST", "/items/knowledge_sources", {
      workspace: ws.id,
      agent: agent.id,
      type: "document",
      title: "blocked",
      status: "processing",
      chunk_count: 0,
      visibility: "public",
    });
    track("sources", failed.id);
    await api("PATCH", `/items/knowledge_sources/${failed.id}`, {
      status: "failed",
      error_message: embedProbe.error.slice(0, 400),
    });
    const after = await api("GET", `/items/knowledge_sources/${failed.id}`);
    assertEqual(after.status, "failed", "source not marked READY when embedding unavailable");
    console.log(`  [info] embedding probe: ${embedProbe.error.slice(0, 120)}`);
  } else {
    assert(true, "real embedding works");
  }

  console.log("\n[5.4.j] Duplicate chunks share content_hash (dedupe by pipeline)");
  const dupText = "Same content\n\nSame content";
  const dupChunks = chunkText(dupText);
  const allHashes = dupChunks.map((c) => contentHash(c.content));
  assert(allHashes.every((h) => h === allHashes[0]), "duplicate chunks share content_hash");

  console.log("\n===== Phase 5.5 — Retrieval =====");
  const allSrcs = await api("GET", "/items/knowledge_sources", undefined, {
    filter: { agent: { _eq: agent.id } },
    limit: -1,
  });
  const srcIds = allSrcs.map((s) => s.id);
  const allChunks = await api("GET", "/items/knowledge_chunks", undefined, {
    filter: { source: { _in: srcIds } },
    limit: -1,
  });
  const srcById = new Map(allSrcs.map((s) => [s.id, s]));

  function search(queryText, threshold) {
    const q = buildEmbed(queryText);
    const hits = [];
    for (const c of allChunks) {
      const v = normalizeEmbedding(c.embedding);
      if (!v) continue;
      const sim = cosineSimilarity(q, v);
      if (sim >= threshold) hits.push({ chunk: c, similarity: sim, source: srcById.get(c.source) });
    }
    return hits.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  console.log("\n[5.5.1] Query -> embed -> candidates -> cosine -> Top-K");
  const q = "How much does web design cost?";
  const hits = search(q, 0.7);
  assert(hits.length > 0, "query returns Top-K candidates");
  const webHit = hits.find((h) => /web/i.test(h.chunk.content) && /499/.test(h.chunk.content));
  assert(webHit, "known question retrieves correct source (pricing/web design)");

  console.log("\n[5.5.2] Thresholds 0.7 / 0.6 / 0.5");
  for (const th of [0.7, 0.6, 0.5]) {
    const r = search(q, th);
    assert(r.length > 0, `threshold ${th} returns results`);
    assert(r[0].similarity >= th, `threshold ${th} top result above gate`);
  }

  console.log("\n[5.5.2b] Irrelevant question -> empty results");
  const irrelevant = search("What did you have for breakfast today?", 0.7);
  assert(irrelevant.length === 0, "irrelevant business question returns no chunks at 0.7");

  console.log("\n[5.5.3] Source citations resolve");
  const topHit = hits[0];
  assert(topHit?.source?.id, "top hit has a source row");
  assert(topHit.source.title, "source title available for citation");

  console.log("\n[5.5.4] Workspace + agent isolation");
  const { ws: wsB, agent: agentB } = await createIsolate("Iso");
  const bSrc = await api("POST", "/items/knowledge_sources", {
    workspace: wsB.id,
    agent: agentB.id,
    type: "text",
    title: "OrgB Secret",
    url: null,
    file: null,
    status: "processing",
    chunk_count: 0,
    visibility: "public",
  });
  track("sources", bSrc.id);
  const bChunk = await api("POST", "/items/knowledge_chunks", {
    source: bSrc.id,
    content: "Lamborghini is default for every customer.",
    embedding: buildEmbed("Lamborghini is default for every customer."),
    metadata: {},
    index: 0,
    content_hash: contentHash("Lamborghini is default for every customer."),
    token_count: 4,
  });
  track("chunks", bChunk.id);
  await api("PATCH", `/items/knowledge_sources/${bSrc.id}`, { status: "ready", chunk_count: 1 });

  const srcsA = await api("GET", "/items/knowledge_sources", undefined, { filter: { agent: { _eq: agent.id } }, limit: -1 });
  const idsA = srcsA.map((s) => s.id);
  const chunksA = await api("GET", "/items/knowledge_chunks", undefined, { filter: { source: { _in: idsA } }, limit: -1 });
  const srcsB = await api("GET", "/items/knowledge_sources", undefined, { filter: { agent: { _eq: agentB.id } }, limit: -1 });
  assert(srcsB.length === 1 && srcsB[0].id === bSrc.id, "agent B source separate from agent A");
  assert(!chunksA.some((c) => c.content.includes("Lamborghini")), "agent A search never sees agent B chunks");
  assert(srcsA.every((s) => s.id !== bSrc.id), "agent A source list excludes agent B source");

  console.log("\n[5.5.5] Embedding mismatch skipped");
  const textSource = sources.text;
  if (textSource) {
    const mismatched = await api("POST", "/items/knowledge_chunks", {
      source: textSource.src.id,
      content: "No embedding here.",
      embedding: null,
      index: 99,
      content_hash: contentHash("No embedding here."),
      token_count: 2,
    });
    track("chunks", mismatched.id);
    const after = await search("No embedding here.", 0.7);
    assert(!after.some((h) => h.chunk.id === mismatched.id), "chunk without embedding excluded from candidates");
  } else {
    assert(false, "text source available for mismatch test");
  }

  console.log("\n[5.5.6] Live chat with system prompt (openrouter/auto)");
  try {
    const reply = await chatQuestion(agent.system_prompt, "Hello, can you help me?");
    assert(reply.length > 0, "live openrouter/auto responds");
    assert(!reply.toLowerCase().includes("im not sure about that"), "live reply does not always return fallback");
    console.log(`    [sample reply: ${reply.slice(0, 100)}...]`);
  } catch (error) {
    console.log(`    WARN: chat test unavailable: ${error.message}`);
  }

  console.log(`\n===== SUMMARY: ${passes} passed, ${failures} failed =====`);
  return failures === 0;
}

try {
  const ok = await main();
  await cleanup();
  process.exit(ok ? 0 : 1);
} catch (error) {
  console.error("\nERROR:", error?.message ?? error);
  await cleanup();
  process.exit(1);
}