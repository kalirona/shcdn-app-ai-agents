-- ============================================================
-- PHASE 2 — Supabase Database Foundation for APP1
-- 003: agents, conversations, messages
-- ============================================================

-- ------------------------------------------------------------
-- agents
-- ------------------------------------------------------------
create table if not exists public.agents (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  name             text not null,
  description      text,
  avatar           text,
  system_prompt    text not null,
  tone             text not null default 'professional'
                     check (tone in ('professional', 'friendly', 'casual', 'custom')),
  language         text not null default 'en',
  greeting         text not null default 'Hello! How can I help you today?',
  fallback_message text not null,
  status           text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  purpose          text,
  primary_goal     text,
  secondary_goal   text,
  fallback_action  text,
  behaviors        text[] not null default '{}',
  allowed_tools    text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- conversations
-- ------------------------------------------------------------
create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  agent_id         uuid not null references public.agents (id) on delete cascade,
  customer_id      uuid,
  customer_email   text,
  customer_name    text,
  status           text not null default 'active'
                     check (status in ('active', 'human_required', 'with_human', 'resolved')),
  handoff_trigger  text,
  handoff_reason   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- messages
-- ------------------------------------------------------------
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant', 'system')),
  content          text not null,
  sources          jsonb,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);