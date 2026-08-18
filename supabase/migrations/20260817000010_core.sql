-- ============================================================
-- PHASE 2 — Supabase Database Foundation for APP1
-- 002: core tables — profiles, workspaces, workspace_members,
--      platform_roles (super admin claim)
--
-- Multi-tenancy: every workspace-owned row carries workspace_id.
-- Auth: auth.users is the ONLY credential source. No passwords in
-- public tables. profiles.user_id = auth.users.id.
-- ============================================================

-- ------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  email                   text not null,
  first_name              text,
  last_name               text,
  status                  text not null default 'active'
                            check (status in ('active', 'invited', 'suspended', 'archived')),
  platform_banned         boolean not null default false,
  ban_reason              text,
  banned_at               timestamptz,
  force_password_reset    boolean not null default false,
  last_access             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.profiles is
  'Public user profile linked 1:1 to auth.users. Credentials live only in auth.users.';

-- ------------------------------------------------------------
-- workspaces (tenant root)
-- ------------------------------------------------------------
create table if not exists public.workspaces (
  id                                uuid primary key default gen_random_uuid(),
  name                              text not null,
  slug                              text not null unique,
  description                       text,
  logo                              text,
  website                           text,
  status                            text not null default 'active'
                                      check (status in ('active', 'suspended', 'archived')),
  plan                              text not null default 'starter'
                                      check (plan in ('starter', 'business', 'pro')),
  subscription_status               text not null default 'free'
                                      check (subscription_status in ('free', 'trialing', 'active', 'past_due', 'canceled')),
  payment_provider                  text,
  payment_provider_subscription_id  text,
  payment_provider_customer_id      text,
  current_period_start              timestamptz,
  current_period_end                timestamptz,
  cancel_at_period_end              boolean not null default false,
  created_at                        timestamptz not null default now(),
  updated_at                        timestamptz not null default now()
);

-- ------------------------------------------------------------
-- workspace_members (user <-> workspace, with workspace role)
-- ------------------------------------------------------------
create table if not exists public.workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text not null default 'member'
                  check (role in ('owner', 'admin', 'member')),
  status        text not null default 'active'
                  check (status in ('active', 'invited', 'inactive')),
  email         text,
  name          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- ------------------------------------------------------------
-- platform_roles (Super Admin claim — platform level, separate
-- from workspace membership). Never derived from client input.
-- ------------------------------------------------------------
create table if not exists public.platform_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role = 'super_admin'),
  status      text not null default 'active' check (status in ('active', 'inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, role)
);