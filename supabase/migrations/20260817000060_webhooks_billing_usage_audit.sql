-- ============================================================
-- PHASE 2 — Supabase Database Foundation for APP1
-- 007: webhooks, webhook_deliveries, webhook_events,
--      subscriptions (billing), ai_usage (provider cost logs),
--      audit_logs
-- ============================================================

-- ------------------------------------------------------------
-- webhooks (outbound, per workspace)
-- ------------------------------------------------------------
create table if not exists public.webhooks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null,
  endpoint_url  text not null,
  events        text[] not null default '{}'
                  check (events <@ array['conversation.created', 'conversation.handoff',
                                         'lead.created', 'booking.created',
                                         'booking.cancelled', 'booking.rescheduled']),
  secret        text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- webhook_deliveries (outbound delivery attempts)
-- ------------------------------------------------------------
create table if not exists public.webhook_deliveries (
  id            uuid primary key default gen_random_uuid(),
  webhook_id    uuid not null references public.webhooks (id) on delete cascade,
  event         text not null,
  status        text not null check (status in ('success', 'failed')),
  http_status   integer,
  response_time integer,
  retry_count   integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- webhook_events (INBOUND provider events — idempotency ledger)
-- ------------------------------------------------------------
create table if not exists public.webhook_events (
  id              uuid primary key default gen_random_uuid(),
  event_id        text not null unique,
  provider        text not null,
  event_type      text not null,
  subscription_id text,
  workspace_id    uuid references public.workspaces (id) on delete set null,
  status          text not null default 'processed' check (status in ('processed', 'failed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- subscriptions (billing — provider subscription per workspace)
-- ------------------------------------------------------------
create table if not exists public.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  provider          text not null check (provider in ('lemon_squeezy', 'stripe')),
  provider_id       text not null,
  customer_id       text,
  plan              text,
  status            text not null default 'active'
                      check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired', 'unpaid')),
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (provider, provider_id)
);

-- ------------------------------------------------------------
-- ai_usage (per-request provider cost log)
-- ------------------------------------------------------------
create table if not exists public.ai_usage (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid references public.workspaces (id) on delete set null,
  agent_id       uuid references public.agents (id) on delete set null,
  user_id        uuid references auth.users (id) on delete set null,
  provider       text not null,
  model          text not null,
  purpose        text not null
                   check (purpose in ('chat', 'fast', 'vision', 'embeddings', 'image', 'video')),
  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  input_cost     numeric(14, 8) not null default 0,
  output_cost    numeric(14, 8) not null default 0,
  total_cost     numeric(14, 8) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- audit_logs (platform-wide audit trail)
-- ------------------------------------------------------------
create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces (id) on delete set null,
  actor_id      uuid references auth.users (id) on delete set null,
  actor_email   text,
  action        text not null,
  category      text not null check (category in ('auth', 'admin', 'workspace', 'user', 'security', 'system')),
  target_type   text,
  target_id     text,
  target_label  text,
  metadata      jsonb,
  ip_address    text,
  user_agent    text,
  status        text not null default 'success' check (status in ('success', 'failure')),
  severity      text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  created_at    timestamptz not null default now()
);