-- ============================================================
-- PHASE 2 — Supabase Database Foundation for APP1
-- 010: functions / RPC
--
--   * match_knowledge_chunks — pgvector similarity search that
--     ENFORCES workspace_id AND agent_id before returning rows.
--   * Super-admin write helpers — the ONLY sanctioned way the app
--     server manages platform singletons / providers / roles.
-- ============================================================

-- ------------------------------------------------------------
-- Vector similarity search RPC.
--
-- Enforces, in the query itself:
--   workspace_id = p_workspace_id   (required)
--   agent_id     = p_agent_id       (nullable -> any agent in workspace)
--   source status = 'ready'
-- Returns top p_match_count chunks above p_match_threshold,
-- ordered by cosine similarity descending.
--
-- SECURITY INVOKER: caller's RLS still applies; combined with the
-- explicit workspace/agent filters this guarantees a user can never
-- read chunks from a workspace they do not belong to, even if a
-- future policy were misconfigured.
-- ------------------------------------------------------------
create or replace function public.match_knowledge_chunks(
  p_query_embedding vector(2048),
  p_workspace_id uuid,
  p_agent_id uuid default null,
  p_match_threshold float default 0.2,
  p_match_count int default 5
)
returns table (
  chunk_id              uuid,
  content               text,
  metadata              jsonb,
  similarity            float,
  source_id             uuid,
  source_title          text,
  source_url            text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id                                        as chunk_id,
    c.content                                   as content,
    c.metadata                                  as metadata,
    1 - (c.embedding_halfvec <=> p_query_embedding::halfvec) as similarity,
    s.id                                        as source_id,
    s.title                                     as source_title,
    s.url                                       as source_url
  from public.knowledge_chunks c
  join public.knowledge_sources s on s.id = c.knowledge_source_id
  where c.workspace_id = p_workspace_id
    and s.status = 'ready'
    and (p_agent_id is null or c.agent_id = p_agent_id)
    and c.embedding_halfvec is not null
    and 1 - (c.embedding_halfvec <=> p_query_embedding::halfvec) >= p_match_threshold
  order by c.embedding_halfvec <=> p_query_embedding::halfvec asc
  limit p_match_count;
$$;

-- ------------------------------------------------------------
-- Super-admin write helpers (security definer).
-- These deliberately bypass RLS so the server can manage platform
-- tables; they are callable only when is_super_admin() is true.
-- ------------------------------------------------------------

-- Promote a user to super admin (or re-activate).
create or replace function public.promote_to_super_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can promote users';
  end if;
  insert into public.platform_roles (user_id, role, status)
  values (p_user_id, 'super_admin', 'active')
  on conflict (user_id, role)
  do update set status = 'active', updated_at = now();
end;
$$;

-- Demote a super admin (cannot demote yourself).
create or replace function public.demote_super_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can demote users';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot demote yourself';
  end if;
  update public.platform_roles
  set status = 'inactive', updated_at = now()
  where user_id = p_user_id and role = 'super_admin';
end;
$$;

-- Upsert an AI provider. api_key is the ENCRYPTED key.
create or replace function public.upsert_ai_provider(
  p_provider_key text,
  p_name text,
  p_type text,
  p_api_key text default null,
  p_base_url text default null,
  p_enabled boolean default false,
  p_priority integer default 0,
  p_default_model text default null,
  p_capabilities text[] default null,
  p_discoverable boolean default true,
  p_input_cost_per_million numeric default null,
  p_output_cost_per_million numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can manage AI providers';
  end if;
  insert into public.ai_providers (
    provider_key, name, type, api_key, base_url, enabled, priority,
    default_model, capabilities, discoverable,
    input_cost_per_million, output_cost_per_million
  ) values (
    p_provider_key, p_name, p_type, p_api_key, p_base_url, p_enabled, p_priority,
    p_default_model, coalesce(p_capabilities, '{}'), p_discoverable,
    p_input_cost_per_million, p_output_cost_per_million
  )
  on conflict (provider_key) do update set
    name = excluded.name,
    type = excluded.type,
    api_key = coalesce(excluded.api_key, public.ai_providers.api_key),
    base_url = coalesce(excluded.base_url, public.ai_providers.base_url),
    enabled = excluded.enabled,
    priority = excluded.priority,
    default_model = excluded.default_model,
    capabilities = excluded.capabilities,
    discoverable = excluded.discoverable,
    input_cost_per_million = excluded.input_cost_per_million,
    output_cost_per_million = excluded.output_cost_per_million,
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- Upsert a model registry entry.
create or replace function public.upsert_ai_model(
  p_provider_id uuid,
  p_model_id text,
  p_name text default null,
  p_capabilities text[] default null,
  p_enabled boolean default true,
  p_context_window integer default null,
  p_input_cost_per_million numeric default null,
  p_output_cost_per_million numeric default null,
  p_source text default 'discovered'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can manage AI models';
  end if;
  insert into public.ai_models (
    provider_id, model_id, name, capabilities, enabled, context_window,
    input_cost_per_million, output_cost_per_million, source
  ) values (
    p_provider_id, p_model_id, p_name, coalesce(p_capabilities, '{}'), p_enabled,
    p_context_window, p_input_cost_per_million, p_output_cost_per_million, p_source
  )
  on conflict (provider_id, model_id) do update set
    name = excluded.name,
    capabilities = excluded.capabilities,
    enabled = excluded.enabled,
    context_window = excluded.context_window,
    input_cost_per_million = excluded.input_cost_per_million,
    output_cost_per_million = excluded.output_cost_per_million,
    source = excluded.source,
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- Upsert AI defaults (singleton — fixed id '00000000-0000-0000-0000-00000000d001').
create or replace function public.upsert_ai_defaults(
  p_chat_model text default null,
  p_fast_model text default null,
  p_vision_model text default null,
  p_embedding_model text default null,
  p_image_model text default null,
  p_video_model text default null,
  p_fallback_provider text default null,
  p_fallback_model text default null,
  p_platform_system_prompt text default null,
  p_platform_safety_rules text default null,
  p_default_system_prompt text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid := '00000000-0000-0000-0000-00000000d001';
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can manage AI defaults';
  end if;
  insert into public.ai_defaults (id, chat_model, fast_model, vision_model, embedding_model,
    image_model, video_model, fallback_provider, fallback_model,
    platform_system_prompt, platform_safety_rules, default_system_prompt)
  values (v_id, p_chat_model, p_fast_model, p_vision_model, p_embedding_model,
    p_image_model, p_video_model, p_fallback_provider, p_fallback_model,
    p_platform_system_prompt, p_platform_safety_rules, p_default_system_prompt)
  on conflict (id) do update set
    chat_model = coalesce(excluded.chat_model, public.ai_defaults.chat_model),
    fast_model = coalesce(excluded.fast_model, public.ai_defaults.fast_model),
    vision_model = coalesce(excluded.vision_model, public.ai_defaults.vision_model),
    embedding_model = coalesce(excluded.embedding_model, public.ai_defaults.embedding_model),
    image_model = coalesce(excluded.image_model, public.ai_defaults.image_model),
    video_model = coalesce(excluded.video_model, public.ai_defaults.video_model),
    fallback_provider = coalesce(excluded.fallback_provider, public.ai_defaults.fallback_provider),
    fallback_model = coalesce(excluded.fallback_model, public.ai_defaults.fallback_model),
    platform_system_prompt = coalesce(excluded.platform_system_prompt, public.ai_defaults.platform_system_prompt),
    platform_safety_rules = coalesce(excluded.platform_safety_rules, public.ai_defaults.platform_safety_rules),
    default_system_prompt = coalesce(excluded.default_system_prompt, public.ai_defaults.default_system_prompt),
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- Upsert platform settings (singleton — fixed id '00000000-0000-0000-0000-00000000d002').
create or replace function public.upsert_platform_settings(
  p_platform_name text default null,
  p_support_email text default null,
  p_maintenance_mode boolean default false,
  p_signup_enabled boolean default true,
  p_default_workspace_plan text default null,
  p_session_timeout_hours integer default null,
  p_require_2fa boolean default false,
  p_smtp_host text default null,
  p_smtp_port integer default null,
  p_smtp_user text default null,
  p_smtp_password text default null,
  p_from_email text default null,
  p_r2_account_id text default null,
  p_r2_access_key_id text default null,
  p_r2_access_key_secret text default null,
  p_r2_bucket text default null,
  p_r2_public_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid := '00000000-0000-0000-0000-00000000d002';
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can manage platform settings';
  end if;
  insert into public.platform_settings (id, platform_name, support_email, maintenance_mode,
    signup_enabled, default_workspace_plan, session_timeout_hours, require_2fa,
    smtp_host, smtp_port, smtp_user, smtp_password, from_email,
    r2_account_id, r2_access_key_id, r2_access_key_secret, r2_bucket, r2_public_url)
  values (v_id, p_platform_name, p_support_email,
    coalesce(p_maintenance_mode, false),
    coalesce(p_signup_enabled, true),
    p_default_workspace_plan, p_session_timeout_hours,
    coalesce(p_require_2fa, false),
    p_smtp_host, p_smtp_port, p_smtp_user, p_smtp_password, p_from_email,
    p_r2_account_id, p_r2_access_key_id, p_r2_access_key_secret, p_r2_bucket, p_r2_public_url)
  on conflict (id) do update set
    platform_name = coalesce(excluded.platform_name, public.platform_settings.platform_name),
    support_email = coalesce(excluded.support_email, public.platform_settings.support_email),
    maintenance_mode = coalesce(p_maintenance_mode, public.platform_settings.maintenance_mode),
    signup_enabled = coalesce(p_signup_enabled, public.platform_settings.signup_enabled),
    default_workspace_plan = coalesce(excluded.default_workspace_plan, public.platform_settings.default_workspace_plan),
    session_timeout_hours = coalesce(excluded.session_timeout_hours, public.platform_settings.session_timeout_hours),
    require_2fa = coalesce(p_require_2fa, public.platform_settings.require_2fa),
    smtp_host = coalesce(excluded.smtp_host, public.platform_settings.smtp_host),
    smtp_port = coalesce(excluded.smtp_port, public.platform_settings.smtp_port),
    smtp_user = coalesce(excluded.smtp_user, public.platform_settings.smtp_user),
    smtp_password = coalesce(excluded.smtp_password, public.platform_settings.smtp_password),
    from_email = coalesce(excluded.from_email, public.platform_settings.from_email),
    r2_account_id = coalesce(excluded.r2_account_id, public.platform_settings.r2_account_id),
    r2_access_key_id = coalesce(excluded.r2_access_key_id, public.platform_settings.r2_access_key_id),
    r2_access_key_secret = coalesce(excluded.r2_access_key_secret, public.platform_settings.r2_access_key_secret),
    r2_bucket = coalesce(excluded.r2_bucket, public.platform_settings.r2_bucket),
    r2_public_url = coalesce(excluded.r2_public_url, public.platform_settings.r2_public_url),
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- Record an audit log entry (used by the app server).
create or replace function public.record_audit_event(
  p_action text,
  p_category text,
  p_workspace_id uuid default null,
  p_actor_id uuid default null,
  p_actor_email text default null,
  p_target_type text default null,
  p_target_id text default null,
  p_target_label text default null,
  p_metadata jsonb default null,
  p_ip_address text default null,
  p_user_agent text default null,
  p_status text default 'success',
  p_severity text default 'info'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.audit_logs (
    workspace_id, actor_id, actor_email, action, category, target_type, target_id,
    target_label, metadata, ip_address, user_agent, status, severity
  ) values (
    p_workspace_id, p_actor_id, p_actor_email, p_action, p_category, p_target_type,
    p_target_id, p_target_label, p_metadata, p_ip_address, p_user_agent, p_status, p_severity
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Record per-request AI usage/cost (used by the app server).
create or replace function public.record_ai_usage(
  p_provider text,
  p_model text,
  p_purpose text,
  p_input_tokens integer default 0,
  p_output_tokens integer default 0,
  p_input_cost numeric default 0,
  p_output_cost numeric default 0,
  p_total_cost numeric default 0,
  p_workspace_id uuid default null,
  p_agent_id uuid default null,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.ai_usage (
    provider, model, purpose, input_tokens, output_tokens,
    input_cost, output_cost, total_cost, workspace_id, agent_id, user_id
  ) values (
    p_provider, p_model, p_purpose, p_input_tokens, p_output_tokens,
    p_input_cost, p_output_cost, p_total_cost, p_workspace_id, p_agent_id, p_user_id
  )
  returning id into v_id;
  return v_id;
end;
$$;