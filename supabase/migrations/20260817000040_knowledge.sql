-- ============================================================
-- PHASE 2 — Supabase Database Foundation for APP1
-- 005: knowledge_sources + knowledge_chunks (pgvector)
--
-- Embedding dimension = 2048 (verified: nvidia/nemotron-3-embed-1b,
-- native dimension, model does not support reduced dimensions).
--
-- INDEXING NOTE:
--   pgvector HNSW/IVFFlat indexes only support `vector` up to
--   2,000 dimensions (halfvec up to 4,000). Because this model
--   returns 2048 dims, we store:
--     embedding          vector(2048)  — full-precision source of truth
--     embedding_halfvec  halfvec(2048) — half-precision copy used by the
--                                        HNSW index and the RPC ranking
--   Both are populated together when a chunk is embedded.
-- ============================================================

-- ------------------------------------------------------------
-- knowledge_sources
-- ------------------------------------------------------------
create table if not exists public.knowledge_sources (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  agent_id       uuid references public.agents (id) on delete cascade,
  type           text not null check (type in ('website', 'document', 'faq', 'text')),
  title          text not null,
  url            text,
  file           text,
  status         text not null default 'pending'
                   check (status in ('pending', 'processing', 'ready', 'failed')),
  error_message  text,
  chunk_count    integer not null default 0,
  visibility     text not null default 'internal' check (visibility in ('public', 'internal')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- knowledge_chunks — pgvector embedding column (2048 dims)
-- ------------------------------------------------------------
create table if not exists public.knowledge_chunks (
  id                   uuid primary key default gen_random_uuid(),
  knowledge_source_id  uuid not null references public.knowledge_sources (id) on delete cascade,
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  agent_id             uuid references public.agents (id) on delete cascade,
  content              text not null,
  metadata             jsonb not null default '{}'::jsonb,
  embedding            vector (2048),
  embedding_halfvec    halfvec (2048),
  index                integer not null default 0,
  content_hash         text,
  token_count          integer,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- HNSW index over the half-precision copy. Chosen over IVFFlat:
-- no training pass, stable recall, fine at this data size. The
-- full-precision `embedding` column cannot be indexed because
-- pgvector caps `vector` index dimensions at 2000.
create index if not exists knowledge_chunks_embedding_hnsw
  on public.knowledge_chunks
  using hnsw (embedding_halfvec halfvec_cosine_ops);