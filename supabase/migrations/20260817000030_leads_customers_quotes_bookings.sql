-- ============================================================
-- PHASE 2 — Supabase Database Foundation for APP1
-- 004: leads, customers, quotes, bookings, calendar_integrations
-- ============================================================

-- ------------------------------------------------------------
-- leads
-- ------------------------------------------------------------
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null,
  email         text not null,
  phone         text,
  company       text,
  message       text,
  source        text,
  status        text not null default 'new'
                  check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  qualification jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- customers
-- ------------------------------------------------------------
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null,
  email         text not null,
  phone         text,
  company       text,
  stage         text not null default 'lead'
                  check (stage in ('anonymous', 'lead', 'customer')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- quotes
-- ------------------------------------------------------------
create table if not exists public.quotes (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  customer_id   uuid references public.customers (id) on delete set null,
  title         text not null,
  amount        numeric(14, 2),
  status        text not null default 'draft'
                  check (status in ('draft', 'sent', 'accepted', 'rejected', 'cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- bookings
-- ------------------------------------------------------------
create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  service         text,
  date            date,
  time            time,
  customer_name   text not null,
  customer_email  text not null,
  customer_phone  text,
  notes           text,
  status          text not null default 'confirmed'
                    check (status in ('confirmed', 'cancelled', 'completed', 'rescheduled')),
  google_event_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- calendar_integrations (Google Calendar OAuth per workspace)
-- Tokens are server-encrypted; never exposed to the browser.
-- ------------------------------------------------------------
create table if not exists public.calendar_integrations (
  id                          uuid primary key default gen_random_uuid(),
  workspace_id                uuid not null references public.workspaces (id) on delete cascade,
  provider                    text not null default 'google' check (provider = 'google'),
  access_token_encrypted      text,
  refresh_token_encrypted     text,
  token_expires_at            timestamptz,
  calendar_id                 text,
  calendar_name               text,
  timezone                    text not null default 'UTC',
  status                      text not null default 'disconnected'
                                check (status in ('connected', 'disconnected', 'error')),
  last_error                  text,
  google_client_id            text,
  google_client_secret_encrypted text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (workspace_id, provider)
);