-- ============================================================
-- PHASE 2 — Supabase Database Foundation for APP1
-- 008: indexes
-- ============================================================

-- profiles
create index if not exists idx_profiles_email on public.profiles (email);

-- workspaces
create index if not exists idx_workspaces_status on public.workspaces (status);
create index if not exists idx_workspaces_slug on public.workspaces (slug);
create index if not exists idx_workspaces_created_at on public.workspaces (created_at desc);

-- workspace_members
create index if not exists idx_workspace_members_workspace on public.workspace_members (workspace_id);
create index if not exists idx_workspace_members_user on public.workspace_members (user_id);
create index if not exists idx_workspace_members_role on public.workspace_members (role);

-- agents
create index if not exists idx_agents_workspace on public.agents (workspace_id);
create index if not exists idx_agents_workspace_status on public.agents (workspace_id, status);
create index if not exists idx_agents_created_at on public.agents (created_at desc);

-- conversations
create index if not exists idx_conversations_workspace on public.conversations (workspace_id);
create index if not exists idx_conversations_agent on public.conversations (agent_id);
create index if not exists idx_conversations_workspace_status on public.conversations (workspace_id, status);
create index if not exists idx_conversations_customer on public.conversations (customer_email);
create index if not exists idx_conversations_created_at on public.conversations (created_at desc);

-- messages
create index if not exists idx_messages_conversation on public.messages (conversation_id);
create index if not exists idx_messages_conversation_created on public.messages (conversation_id, created_at);
create index if not exists idx_messages_created_at on public.messages (created_at);

-- leads
create index if not exists idx_leads_workspace on public.leads (workspace_id);
create index if not exists idx_leads_email on public.leads (email);
create index if not exists idx_leads_status on public.leads (status);
create index if not exists idx_leads_workspace_created on public.leads (workspace_id, created_at desc);

-- customers
create index if not exists idx_customers_workspace on public.customers (workspace_id);
create index if not exists idx_customers_email on public.customers (email);
create index if not exists idx_customers_workspace_created on public.customers (workspace_id, created_at desc);

-- quotes
create index if not exists idx_quotes_workspace on public.quotes (workspace_id);
create index if not exists idx_quotes_customer on public.quotes (customer_id);
create index if not exists idx_quotes_status on public.quotes (status);

-- bookings
create index if not exists idx_bookings_workspace on public.bookings (workspace_id);
create index if not exists idx_bookings_email on public.bookings (customer_email);
create index if not exists idx_bookings_status on public.bookings (status);
create index if not exists idx_bookings_workspace_date on public.bookings (workspace_id, date);

-- calendar_integrations
create index if not exists idx_calendar_integrations_workspace on public.calendar_integrations (workspace_id);
create index if not exists idx_calendar_integrations_status on public.calendar_integrations (status);

-- knowledge_sources
create index if not exists idx_knowledge_sources_workspace on public.knowledge_sources (workspace_id);
create index if not exists idx_knowledge_sources_agent on public.knowledge_sources (agent_id);
create index if not exists idx_knowledge_sources_status on public.knowledge_sources (status);
create index if not exists idx_knowledge_sources_workspace_agent on public.knowledge_sources (workspace_id, agent_id);

-- knowledge_chunks
create index if not exists idx_knowledge_chunks_source on public.knowledge_chunks (knowledge_source_id);
create index if not exists idx_knowledge_chunks_workspace on public.knowledge_chunks (workspace_id);
create index if not exists idx_knowledge_chunks_agent on public.knowledge_chunks (agent_id);
create index if not exists idx_knowledge_chunks_workspace_agent on public.knowledge_chunks (workspace_id, agent_id);
create index if not exists idx_knowledge_chunks_content_hash on public.knowledge_chunks (content_hash);

-- ai_providers
create index if not exists idx_ai_providers_enabled on public.ai_providers (enabled);
create index if not exists idx_ai_providers_priority on public.ai_providers (priority desc);

-- ai_models
create index if not exists idx_ai_models_provider on public.ai_models (provider_id);
create index if not exists idx_ai_models_provider_model on public.ai_models (provider_id, model_id);
create index if not exists idx_ai_models_capabilities on public.ai_models using gin (capabilities);

-- webhooks
create index if not exists idx_webhooks_workspace on public.webhooks (workspace_id);

-- webhook_deliveries
create index if not exists idx_webhook_deliveries_webhook on public.webhook_deliveries (webhook_id);
create index if not exists idx_webhook_deliveries_created on public.webhook_deliveries (created_at);

-- webhook_events
create index if not exists idx_webhook_events_provider on public.webhook_events (provider);
create index if not exists idx_webhook_events_created on public.webhook_events (created_at);

-- subscriptions
create index if not exists idx_subscriptions_workspace on public.subscriptions (workspace_id);
create index if not exists idx_subscriptions_status on public.subscriptions (status);

-- ai_usage
create index if not exists idx_ai_usage_workspace on public.ai_usage (workspace_id);
create index if not exists idx_ai_usage_agent on public.ai_usage (agent_id);
create index if not exists idx_ai_usage_provider_model on public.ai_usage (provider, model);
create index if not exists idx_ai_usage_created on public.ai_usage (created_at);

-- audit_logs
create index if not exists idx_audit_logs_workspace on public.audit_logs (workspace_id);
create index if not exists idx_audit_logs_actor on public.audit_logs (actor_id);
create index if not exists idx_audit_logs_action on public.audit_logs (action);
create index if not exists idx_audit_logs_category on public.audit_logs (category);
create index if not exists idx_audit_logs_created on public.audit_logs (created_at desc);