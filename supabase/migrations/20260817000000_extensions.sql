-- ============================================================
-- PHASE 2 — Supabase Database Foundation for APP1
-- 001: extensions
-- Enable required PostgreSQL extensions:
--   - pgcrypto  : gen_random_uuid() and pgp encryption helpers
--   - vector    : pgvector for knowledge embeddings (dim 2048)
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists vector;