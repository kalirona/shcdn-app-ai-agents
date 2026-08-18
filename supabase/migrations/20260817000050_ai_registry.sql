-- ============================================================
-- PHASE 2 — Supabase Database Foundation for APP1
-- 006: AI registry — ai_providers, ai_models, ai_defaults,
--      platform_settings (platform-level, singleton where noted)
--
-- SECURITY: ai_providers.api_key holds the ENCRYPTED provider key.
-- No public SELECT policy exposes it (see RLS migration). The
-- server decrypts with AI_API_KEY_ENCRYPTION_KEY. Never returned
-- to the browser.
-- ============================================================

-- ------------------------------------------------------------
-- ai_providers (platform level; encrypted api_key, server-only)
-- ------------------------------------------------------------
create table if not exists public.ai_providers (
  id                        uuid primary key default gen_random_uuid(),
  provider_key              text not null unique
                              check (provider_key in ('openrouter', 'gemini', 'openai', 'anthropic',
                                                      'glm', 'together', 'groq', 'ollama', 'custom')),
  name                      text not null,
  type                      text not null
                              check (type in ('openai', 'anthropic', 'gemini', 'ollama', 'openrouter',
                                              'glm', 'together', 'groq', 'custom')),
  api_key                   text,
  base_url                  text,
  enabled                   boolean not null default false,
  priority                  integer not null default 0,
  default_model             text,
  capabilities              text[] not null default '{}'
                              check (capabilities <@ array['chat', 'vision', 'embeddings', 'image', 'video']),
  status                    text not null default 'untested'
                              check (status in ('untested', 'ok', 'error')),
  last_tested_at            timestamptz,
  last_error                text,
  discoverable              boolean not null default true,
  input_cost_per_million    numeric(14, 6),
  output_cost_per_million   numeric(14, 6),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ai_models (registry entries per provider)
-- ------------------------------------------------------------
create table if not exists public.ai_models (
  id                        uuid primary key default gen_random_uuid(),
  provider_id               uuid not null references public.ai_providers (id) on delete cascade,
  model_id                  text not null,
  name                      text,
  capabilities              text[] not null default '{}'
                              check (capabilities <@ array['chat', 'vision', 'embeddings', 'image', 'video']),
  enabled                   boolean not null default true,
  context_window            integer,
  input_cost_per_million    numeric(14, 6),
  output_cost_per_million   numeric(14, 6),
  source                    text not null default 'discovered'
                              check (source in ('discovered', 'manual')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (provider_id, model_id)
);

-- ------------------------------------------------------------
-- ai_defaults (singleton — one row)
-- ------------------------------------------------------------
create table if not exists public.ai_defaults (
  id                       uuid primary key
                             default '00000000-0000-0000-0000-00000000d001'
                             check (id = '00000000-0000-0000-0000-00000000d001'),
  chat_model               text,
  fast_model               text,
  vision_model             text,
  embedding_model          text,
  image_model              text,
  video_model              text,
  fallback_provider        text,
  fallback_model           text,
  platform_system_prompt   text,
  platform_safety_rules    text,
  default_system_prompt    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ------------------------------------------------------------
-- platform_settings (singleton — one row)
-- ------------------------------------------------------------
create table if not exists public.platform_settings (
  id                        uuid primary key
                              default '00000000-0000-0000-0000-00000000d002'
                              check (id = '00000000-0000-0000-0000-00000000d002'),
  platform_name             text,
  support_email             text,
  maintenance_mode          boolean not null default false,
  signup_enabled            boolean not null default true,
  default_workspace_plan    text,
  session_timeout_hours     integer,
  require_2fa               boolean not null default false,
  smtp_host                 text,
  smtp_port                 integer,
  smtp_user                 text,
  smtp_password             text,
  from_email                text,
  r2_account_id             text,
  r2_access_key_id          text,
  r2_access_key_secret      text,
  r2_bucket                 text,
  r2_public_url             text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);