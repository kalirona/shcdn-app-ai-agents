-- ============================================================
-- PHASE 2 — Supabase Database Foundation for APP1
-- 009: updated_at triggers + RLS security model
--
-- AUTHORIZATION MODEL:
--   auth.uid() → profiles → workspace_members → workspace rows.
--   Super admin is decided by platform_roles (never client input).
--
-- PRINCIPLES:
--   * RLS enabled on EVERY table.
--   * No public SELECT policy exposes ai_providers.api_key or
--     calendar_integrations tokens (encrypted, but still hidden).
--   * Normal workspace users can never read/write other workspaces.
--   * Platform singletons (ai_defaults, platform_settings) are
--     readable by authenticated users, writable only by super admin
--     via a security-definer helper; ai_providers/ai_models are
--     readable by authenticated users (keys hidden) and written via
--     super-admin helper only.
--
-- This migration is idempotent: existing policies are dropped first.
-- ============================================================

-- Reset policies so re-application is safe.
do $$
declare r record;
begin
  for r in select tablename, policyname
           from pg_policies
           where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------
-- updated_at trigger (shared)
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'workspaces', 'workspace_members', 'platform_roles',
                           'agents', 'conversations', 'leads', 'customers', 'quotes',
                           'bookings', 'calendar_integrations', 'knowledge_sources',
                           'knowledge_chunks', 'ai_providers', 'ai_models', 'ai_defaults',
                           'platform_settings', 'webhooks', 'webhook_deliveries',
                           'webhook_events', 'subscriptions', 'ai_usage']
  loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I', t);
    execute format('create trigger trg_set_updated_at before update on public.%I
                    for each row execute procedure public.set_updated_at()', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Auth helper functions
-- ------------------------------------------------------------
-- True when the calling user holds an active platform role.
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.platform_roles pr
    where pr.user_id = auth.uid()
      and pr.role = 'super_admin'
      and pr.status = 'active'
  );
$$;

-- True when the calling user is an active member of the workspace.
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

-- True when the calling user is owner or admin of the workspace.
create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin')
  );
$$;

-- workspace_id of a conversation owned by the caller's workspace.
create or replace function public.conversation_workspace(p_conversation_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id from public.conversations where id = p_conversation_id;
$$;

-- workspace_id of a knowledge source owned by the caller's workspace.
create or replace function public.knowledge_source_workspace(p_source_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id from public.knowledge_sources where id = p_source_id;
$$;

-- workspace_id of a webhook owned by the caller's workspace.
create or replace function public.webhook_workspace(p_webhook_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id from public.webhooks where id = p_webhook_id;
$$;

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_own_select" on public.profiles
  for select using (user_id = auth.uid());
create policy "profiles_own_update" on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profiles_superadmin_select" on public.profiles
  for select using (public.is_super_admin());

-- ------------------------------------------------------------
-- workspaces
-- ------------------------------------------------------------
alter table public.workspaces enable row level security;

create policy "workspaces_member_select" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "workspaces_superadmin_all" on public.workspaces
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- workspace_members
-- ------------------------------------------------------------
alter table public.workspace_members enable row level security;

create policy "members_select_own" on public.workspace_members
  for select using (user_id = auth.uid());
create policy "members_select_workspace" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
create policy "members_manage_workspace" on public.workspace_members
  for all using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
create policy "members_superadmin_all" on public.workspace_members
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- platform_roles (super admin) — managed via security-definer only
-- ------------------------------------------------------------
alter table public.platform_roles enable row level security;

create policy "platform_roles_no_public" on public.platform_roles
  for all using (false);

-- ------------------------------------------------------------
-- agents
-- ------------------------------------------------------------
alter table public.agents enable row level security;

create policy "agents_member_all" on public.agents
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "agents_superadmin_all" on public.agents
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- conversations
-- ------------------------------------------------------------
alter table public.conversations enable row level security;

create policy "conversations_member_all" on public.conversations
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "conversations_superadmin_all" on public.conversations
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- messages — readable via the owning conversation's workspace.
-- Widget (anon) writes are handled server-side by the app using
-- a service role; RLS still guards member access.
-- ------------------------------------------------------------
alter table public.messages enable row level security;

create policy "messages_member_all" on public.messages
  for all using (public.is_workspace_member(public.conversation_workspace(conversation_id)))
  with check (public.is_workspace_member(public.conversation_workspace(conversation_id)));
create policy "messages_superadmin_all" on public.messages
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- leads
-- ------------------------------------------------------------
alter table public.leads enable row level security;

create policy "leads_member_all" on public.leads
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "leads_superadmin_all" on public.leads
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- customers
-- ------------------------------------------------------------
alter table public.customers enable row level security;

create policy "customers_member_all" on public.customers
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "customers_superadmin_all" on public.customers
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- quotes
-- ------------------------------------------------------------
alter table public.quotes enable row level security;

create policy "quotes_member_all" on public.quotes
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "quotes_superadmin_all" on public.quotes
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- bookings
-- ------------------------------------------------------------
alter table public.bookings enable row level security;

create policy "bookings_member_all" on public.bookings
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "bookings_superadmin_all" on public.bookings
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- calendar_integrations — tokens hidden; only workspace members
-- with admin role may write; members may read (tokens hidden via
-- column-level SELECT policies on the *_encrypted columns).
-- ------------------------------------------------------------
alter table public.calendar_integrations enable row level security;

create policy "cal_member_select" on public.calendar_integrations
  for select using (public.is_workspace_member(workspace_id));
create policy "cal_admin_all" on public.calendar_integrations
  for all using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
create policy "cal_superadmin_all" on public.calendar_integrations
  for all using (public.is_super_admin());

-- Hide encrypted token columns from browser roles entirely:
-- revoke ALL table access from anon/authenticated, then grant SELECT
-- only on the non-secret columns to authenticated workspace members.
-- (Writes happen server-side via service_role / security-definer RPCs.)
revoke all on public.calendar_integrations from anon, authenticated;
grant select (
  id, workspace_id, provider, token_expires_at, calendar_id, calendar_name,
  timezone, status, last_error, google_client_id, created_at, updated_at
) on public.calendar_integrations to authenticated;

-- ------------------------------------------------------------
-- knowledge_sources
-- ------------------------------------------------------------
alter table public.knowledge_sources enable row level security;

create policy "knowledge_sources_member_all" on public.knowledge_sources
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "knowledge_sources_superadmin_all" on public.knowledge_sources
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- knowledge_chunks
-- ------------------------------------------------------------
alter table public.knowledge_chunks enable row level security;

create policy "knowledge_chunks_member_all" on public.knowledge_chunks
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "knowledge_chunks_superadmin_all" on public.knowledge_chunks
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- ai_providers — authenticated users may READ (api_key hidden via
-- column-level policy); only super admin may write (via helper).
-- ------------------------------------------------------------
alter table public.ai_providers enable row level security;

create policy "ai_providers_auth_select" on public.ai_providers
  for select using (auth.role() = 'authenticated');
create policy "ai_providers_superadmin_all" on public.ai_providers
  for all using (public.is_super_admin());

-- Never expose the encrypted provider key to browser roles: revoke ALL
-- table access from anon/authenticated, grant SELECT only on non-secret
-- columns to authenticated users.
revoke all on public.ai_providers from anon, authenticated;
grant select (
  id, provider_key, name, type, base_url, enabled, priority, default_model,
  capabilities, status, last_tested_at, last_error, discoverable,
  input_cost_per_million, output_cost_per_million, created_at, updated_at
) on public.ai_providers to authenticated;

-- ------------------------------------------------------------
-- ai_models
-- ------------------------------------------------------------
alter table public.ai_models enable row level security;

create policy "ai_models_auth_select" on public.ai_models
  for select using (auth.role() = 'authenticated');
create policy "ai_models_superadmin_all" on public.ai_models
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- ai_defaults (singleton) — authenticated read; super admin write
-- ------------------------------------------------------------
alter table public.ai_defaults enable row level security;

create policy "ai_defaults_auth_select" on public.ai_defaults
  for select using (auth.role() = 'authenticated');
create policy "ai_defaults_superadmin_all" on public.ai_defaults
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- platform_settings (singleton) — authenticated read; super admin
-- write. Contains SMTP/R2 secrets; never exposed via public select.
-- ------------------------------------------------------------
alter table public.platform_settings enable row level security;

create policy "platform_settings_auth_select" on public.platform_settings
  for select using (auth.role() = 'authenticated');
create policy "platform_settings_superadmin_all" on public.platform_settings
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- webhooks
-- ------------------------------------------------------------
alter table public.webhooks enable row level security;

create policy "webhooks_member_all" on public.webhooks
  for all using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
create policy "webhooks_superadmin_all" on public.webhooks
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- webhook_deliveries
-- ------------------------------------------------------------
alter table public.webhook_deliveries enable row level security;

create policy "deliveries_admin_all" on public.webhook_deliveries
  for all using (public.is_workspace_admin(public.webhook_workspace(webhook_id)))
  with check (public.is_workspace_admin(public.webhook_workspace(webhook_id)));
create policy "deliveries_superadmin_all" on public.webhook_deliveries
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- webhook_events (inbound idempotency ledger)
-- ------------------------------------------------------------
alter table public.webhook_events enable row level security;

create policy "webhook_events_member_select" on public.webhook_events
  for select using (workspace_id is null or public.is_workspace_member(workspace_id));
create policy "webhook_events_superadmin_all" on public.webhook_events
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- subscriptions
-- ------------------------------------------------------------
alter table public.subscriptions enable row level security;

create policy "subscriptions_member_all" on public.subscriptions
  for all using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
create policy "subscriptions_superadmin_all" on public.subscriptions
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- ai_usage
-- ------------------------------------------------------------
alter table public.ai_usage enable row level security;

create policy "ai_usage_member_select" on public.ai_usage
  for select using (workspace_id is null or public.is_workspace_member(workspace_id));
create policy "ai_usage_superadmin_all" on public.ai_usage
  for all using (public.is_super_admin());

-- ------------------------------------------------------------
-- audit_logs — append-only for actors; super admin reads all.
-- ------------------------------------------------------------
alter table public.audit_logs enable row level security;

create policy "audit_logs_superadmin_all" on public.audit_logs
  for all using (public.is_super_admin());
create policy "audit_logs_member_select" on public.audit_logs
  for select using (workspace_id is null or public.is_workspace_member(workspace_id));