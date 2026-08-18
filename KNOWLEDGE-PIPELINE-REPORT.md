# Phase 3.2 Report — Knowledge Pipeline (Documents, Chunking, Embeddings, Retrieval)

**Date**: August 14, 2026
**Scope**: Production-grade document ingestion → extraction → chunking → embedding → vector store → retrieval → Agent context, plus re-index/delete lifecycle, cross-workspace isolation, and UI status surfacing.

---

## What was already working (Phase 3.1)

| Area | Status |
|------|--------|
| Embedding provider abstraction (`gateway.ts`, `provider.ts`) with OpenAI-compatible, Gemini, Cohere, Ollama, Together | ✅ |
| `embedText()` resolver with gateway fallback | ✅ |
| Website crawl → chunk → embed → store (`addWebsiteSource`) | ✅ |
| Cosine retrieval scoped by workspace + agent, ready-status-only, threshold 0.7, top-K 5 (`vector-search.ts`) | ✅ |
| RAG context injection + sources in `ragQuery` / `ragStreamQuery` | ✅ |
| Delete removes chunks server-side (`knowledge.repo.ts`) | ✅ |
| Authz via `requireWorkspaceAccess` on knowledge actions | ✅ |

## What was broken / missing (found in audit)

1. `chunkText()` collapsed whitespace before splitting, so it always emitted **one giant chunk** per document.
2. `addDocumentSource` only created a source row — **no text extraction, chunking, or embedding**.
3. Text / document / FAQ / delete UI used **localStorage mocks** (`status: "ready"` hardcoded, never called server actions).
4. No re-index lifecycle (stale vectors lingered after content changed).
5. No `content_hash`-based dedup / skip for unchanged re-indexes.
6. No PDF / DOCX / CSV / MD extraction (no deps available — no npm installer on machine).
7. `isAllowedUrl` only blocked literal private-IP hostnames — DNS-rebinding gap (now fixed; see SSRF hardening below).

## What was fixed / built

### Chunking — `src/lib/security/chunking.ts` (rewritten)
- Paragraph-preserving splitter; oversized blocks subdivided on sentence → word boundaries.
- Word-aligned overlap, bounded chunks (`maxChunkSize=1000`, `minChunkSize=60`, `overlap=100`), trailing tiny chunks merged.
- Records `charStart` / `charEnd` / `wordCount` per chunk.
- Added `contentHash()` (sha256 hex) and `chunkMarkdown()` (heading-aware).
- Verified: 1260-char input → 7 chunks (~192–200 chars) with correct overlap; paragraph text stays whole.

### Document extraction — `src/lib/ai/document-extractor.ts` (new, zero-dependency)
- `extractTextFromFile(file)` dispatches by MIME/extension.
- **TXT / MD**: UTF-8 decode. **CSV**: quote-aware parser → `header: value` sentence rows.
- **PDF** (best-effort): FlateDecode streams via `inflateSync`/`inflateRawSync`, `BT...ET` blocks, `Tj`/`TJ` text operators, octal escape decoding. Scanned/image PDFs throw descriptive errors → source marked `failed`.
- **DOCX**: hand-rolled ZIP central-directory reader (`word/document.xml`, deflate/stored), XML text extraction.
- Tests: TXT ✅, CSV ✅, PDF ✅ (`Acme Dental emergency phone 555-0199`), DOCX ✅, bad-PDF error path ✅.

### Ingestion — `src/lib/auth/actions/knowledge/knowledge.actions.ts`
- **`addDocumentSource`** now: validates file (type + 10MB cap) → creates source → `processing` → extract → `chunkText` (paragraph) → `indexChunks` → `ready`; any failure marks `failed` with `error_message`.
- **`indexChunks`** (shared): per chunk → `contentHash` → skip if same hash already exists for the source → `embedText` → write chunk with `content_hash`, `token_count`, merged metadata. Returns number newly written.
- Text / FAQ / website handlers refactored onto `indexChunks`; FAQ chunks carry unique `index` + `metadata.type = "faq"`.
- **`reindexKnowledgeSource`** (new): website re-crawls; text/faq/document re-embed from stored chunks; deletes the previous generation of vectors first (no stale chunks), then rewrites; status lifecycle preserved.
- **`deleteKnowledgeSource`**: unchanged server-side cascade (chunks then source).

### Data layer — `src/lib/db`
- Added `content_hash: string | null` and `token_count: number | null` to `KnowledgeChunkEntity`.
- Created both fields on the **live Directus collection** `knowledge_chunks` (verified via API schema: id, source, content, embedding, metadata, index, date_created, date_updated, content_hash, token_count).

### UI — `knowledge-dialogs.tsx` + `knowledge/page.tsx`
- Removed all localStorage mocks (`getStoredSources`, `saveSources`, `generateId`, `storedWorkspaceId`, `getKnowledgeSourcesForAgent`).
- Text / document / FAQ dialogs now call real server actions; status-driven toasts (ready / failed with `error_message` / in-progress).
- Document dialog submits real `FormData` to `addDocumentSource`.
- Delete button calls `deleteKnowledgeSource`; **new re-index button** (`RefreshCw`) on each card calls `reindexKnowledgeSource`.
- Page loads sources from `getAgentKnowledgeSources` server action (via `loadKnowledgeSources` helper) with cancel-guard on unmount; surfaces counts and per-source status badges.

### SSRF hardening — `src/lib/security/upload-security.ts`
- Added `assertPublicUrl()` (server-side): calls `isAllowedUrl` for the static checks, then resolves DNS and rejects when any resolved address is private/loopback, closing the DNS-rebinding window before crawling.
- `addWebsiteSource` and `reindexKnowledgeSource` now use `assertPublicUrl`; verified against live Directus that `isAllowedUrl` / DNS resolution behave correctly.

## Regression gate
- `tsc --noEmit`: **clean** (also fixed pre-existing type errors in `api/chat/route.ts`, `api/widget/chat/route.ts`, `website-crawler.ts` caused by nullable `title`).
- Biome `check` on all touched files: **clean**.
- Extractor tests: TXT/CSV/PDF/DOCX/error-path all pass.
- Dedup/re-index simulation: unchanged content → 0 new writes (hash skip); changed content → stale replaced.
- Directus schema + filter verification (live): `content_hash`/`token_count` fields exist; compound `source` + `content_hash` filters and numeric-coerced `source` filters return correctly.

## Limitations / notes
- **No embedding API key configured** on any enabled Directus AI provider and no `AI_PROVIDER`/`OPENAI_API_KEY` env → a live end-to-end embed call cannot be exercised; retrieval/chunking/isolation were validated with stubs and the real Directus REST layer only for schema. Once a key is set on a provider, ingestion should work unmodified.
- **PDF parser is best-effort**: handles the common FlateDecode + `Tj`/`TJ` case; PDFs using JPEG2000/CCITT filters or scan-only pages will be marked `failed` rather than silently empty.
- `npm run build` was not run (`node_modules/next/dist/bin/next` absent on this machine); `tsc --noEmit` is the standing regression gate.
- Re-index for documents/text/faq re-embeds the previously extracted text; the original uploaded file is not retained server-side.
