-- ============================================================================
-- PHASE 4.3C — Sitenex AI: least-privilege EXECUTE on AI RPCs
--
-- Problem: the four security-definer helpers below were created with the
-- Postgres default ACL (EXECUTE to PUBLIC) plus explicit grants to anon,
-- authenticated and service_role. Combined with a publicly known anon key,
-- that let unauthenticated callers invoke platform AI configuration
-- functions (denied only by the internal is_super_admin() check, and in the
-- case of record_ai_usage, not denied at all).
--
-- Application reality: NO application code calls these RPCs. All AI
-- configuration mutations flow through Next.js server actions
-- (requirePlatformAccess) writing via the service-role client, and cost
-- logging writes ai_usage directly. The intended privileged transport is
-- therefore service_role only.
--
-- Change: EXECUTE revoked from PUBLIC, anon and authenticated on exactly
-- these four functions; granted to service_role. Internal authorization
-- checks are preserved untouched. RLS on the underlying tables is not
-- modified by this migration.
-- ============================================================================

revoke execute on function public.upsert_ai_provider(text, text, text, text, text, boolean, integer, text, text[], boolean, numeric, numeric)
  from public, anon, authenticated;
revoke execute on function public.upsert_ai_model(uuid, text, text, text[], boolean, integer, numeric, numeric, text)
  from public, anon, authenticated;
revoke execute on function public.upsert_ai_defaults(text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.record_ai_usage(text, text, text, integer, integer, numeric, numeric, numeric, uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.upsert_ai_provider(text, text, text, text, text, boolean, integer, text, text[], boolean, numeric, numeric)
  to service_role;
grant execute on function public.upsert_ai_model(uuid, text, text, text[], boolean, integer, numeric, numeric, text)
  to service_role;
grant execute on function public.upsert_ai_defaults(text, text, text, text, text, text, text, text, text, text, text)
  to service_role;
grant execute on function public.record_ai_usage(text, text, text, integer, integer, numeric, numeric, numeric, uuid, uuid, uuid)
  to service_role;
