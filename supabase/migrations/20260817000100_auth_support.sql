-- ============================================================
-- PHASE 3 — Supabase Auth Support
-- 001: auto-provision a public.profiles row for every auth.users
--      signup, so the identity chain (auth.users -> profiles ->
--      workspace_members -> workspaces) is always intact.
--
-- Profiles have NO user INSERT policy (Phase 2 RLS): only own
-- SELECT/UPDATE plus super-admin SELECT. Workspace auto-provisioning
-- is intentionally NOT done here — it runs server-side via the
-- service-role client on first login (see supabase-identity.ts), and
-- requires business logic (slug uniqueness, plan defaults) the app
-- owns.
--
-- SECURITY: security definer so the trigger may write the profile
-- regardless of RLS; search_path pinned to prevent search-path
-- hijacking. Reads only auth.users columns available on insert.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_name text;
  v_last_name  text;
  v_name       text;
begin
  v_name := nullif(new.raw_user_meta_data ->> 'name', '');
  if v_name is null then
    v_first_name := nullif(new.raw_user_meta_data ->> 'first_name', '');
    v_last_name  := nullif(new.raw_user_meta_data ->> 'last_name', '');
  else
    -- split "First Last" on the first space
    v_first_name := split_part(v_name, ' ', 1);
    v_last_name  := nullif(trim(substr(v_name, length(v_first_name) + 1)), '');
  end if;

  insert into public.profiles (user_id, email, first_name, last_name, status)
  values (new.id, new.email, v_first_name, v_last_name, 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
