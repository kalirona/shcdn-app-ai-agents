-- ============================================================================
-- PHASE 4.3D — Sitenex AI: RPC hardening part 2 (remaining definer helpers)
--
-- Inventory found 16 SECURITY DEFINER functions. Four were hardened in
-- 20260817000110. This migration hardens the rest by classification:
--
-- STRICT (server/internal only — zero application callers, privileged data):
--   record_audit_event        : inserts audit rows, NO internal authz check.
--   promote_to_super_admin    : platform role escalation; internal
--                               is_super_admin() + self-demote guards kept.
--   demote_super_admin        : same guard family; kept intact.
--   upsert_platform_settings  : writes SMTP/R2 secrets; internal
--                               is_super_admin() kept.
--   => EXECUTE: service_role only.
--
-- PARTIAL (evaluated inside RLS policies and called directly by the
-- application under the authenticated role — supabase-identity.ts calls
-- is_super_admin via rpc on the session client):
--   is_super_admin(), is_workspace_member(uuid), is_workspace_admin(uuid)
--   => revoke PUBLIC + anon only; authenticated/service_role keep EXECUTE so
--      policies and the identity layer keep working for signed-in users.
--
-- UNTOUCHED (infrastructure, documented in the phase report):
--   conversation_workspace(uuid), knowledge_source_workspace(uuid),
--   webhook_workspace(uuid)  : RLS row-resolvers evaluated under arbitrary
--                              policy roles; no privileged writes.
--   set_updated_at()         : BEFORE UPDATE trigger function.
--   handle_new_user()        : GoTrue signup trigger (owner supabase_admin).
-- ============================================================================

-- ---- STRICT: internal/admin only -------------------------------------------
revoke execute on function public.record_audit_event(text, text, uuid, uuid, text, text, text, text, jsonb, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.promote_to_super_admin(uuid)
  from public, anon, authenticated;
revoke execute on function public.demote_super_admin(uuid)
  from public, anon, authenticated;
revoke execute on function public.upsert_platform_settings(text, text, boolean, boolean, text, integer, boolean, text, integer, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.record_audit_event(text, text, uuid, uuid, text, text, text, text, jsonb, text, text, text, text)
  to service_role;
grant execute on function public.promote_to_super_admin(uuid)
  to service_role;
grant execute on function public.demote_super_admin(uuid)
  to service_role;
grant execute on function public.upsert_platform_settings(text, text, boolean, boolean, text, integer, boolean, text, integer, text, text, text, text, text, text, text, text)
  to service_role;

-- ---- PARTIAL: policy/identity helpers — drop PUBLIC+anon only ---------------
revoke execute on function public.is_super_admin()
  from public, anon;
revoke execute on function public.is_workspace_member(uuid)
  from public, anon;
revoke execute on function public.is_workspace_admin(uuid)
  from public, anon;
