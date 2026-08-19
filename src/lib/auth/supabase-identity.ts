import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MembershipEntity } from "@/lib/db/entities";

/**
 * Supabase identity resolution (server-only).
 *
 * The identity chain is strictly:
 *   auth.users (session) -> public.profiles -> public.workspace_members -> public.workspaces
 *
 * Reads use the authenticated server client so RLS scopes every row to the
 * session user — no client-supplied user_id/workspace_id/role is ever trusted
 * as an authorization decision. Provisioning (profile/workspace on first login)
 * and platform singletons (platform_roles, platform_settings) run through the
 * server-only service-role client, which RLS intentionally forbids for normal
 * users.
 */

export interface SupabaseWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  website: string | null;
  status: string;
  plan: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * The authenticated user's workspaces (via workspace_members, RLS-scoped).
 */
export async function getSupabaseUserWorkspaces(userId: string): Promise<SupabaseWorkspaceSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      "workspace_id, role, status, workspaces!inner(id, name, slug, description, logo, website, status, plan, created_at, updated_at)",
    )
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const w = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
    if (!w) {
      throw new Error("Workspace membership missing its workspace row.");
    }
    return {
      id: w.id,
      name: w.name,
      slug: w.slug,
      description: w.description,
      logo: w.logo,
      website: w.website,
      status: w.status,
      plan: w.plan,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    };
  });
}

/**
 * All workspaces across the platform (super-admin overview). Runs through the
 * service-role client: the admin pages are gated by requirePlatformAccess(), and
 * normal users must never be able to list other users' workspaces via RLS.
 */
export async function getSupabaseAllWorkspaces(): Promise<SupabaseWorkspaceSummary[]> {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from("workspaces")
    .select("id,name,slug,description,logo,website,status,plan,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    description: w.description,
    logo: w.logo,
    website: w.website,
    status: w.status,
    plan: w.plan,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  }));
}

/**
 * The user's role in a workspace. RLS limits the result to the session user's
 * own membership, so callers must pass the session user's id (enforced by
 * access-core which always resolves identity from the session).
 */
export async function getSupabaseUserRole(workspaceId: string, userId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.role ?? null;
}

export interface SupabaseMembershipSummary {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  status: string;
  email: string | null;
  name: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * All workspace memberships across the platform (super-admin overview). Runs
 * through the service-role client because workspace_members RLS limits reads to
 * the session user's own memberships; the admin pages are gated by
 * requirePlatformAccess().
 */
export async function getSupabaseAllMemberships(): Promise<MembershipEntity[]> {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from("workspace_members")
    .select("id,workspace_id,user_id,role,status,email,name,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    workspace: row.workspace_id,
    user: row.user_id,
    role: row.role as MembershipEntity["role"],
    status: row.status as MembershipEntity["status"],
    email: row.email,
    name: row.name,
    date_created: row.created_at,
    date_updated: row.updated_at,
  }));
}

/**
 * Whether the CURRENT session user holds an active platform role, resolved via
 * the security-definer is_super_admin() RPC (auth.uid()-bound, RLS-blessed;
 * platform_roles has no public select). The userId argument is the session
 * user's id — the RPC inherently checks auth.uid(), never a client-supplied id.
 */
export async function isSupabaseSuperAdmin(_userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("is_super_admin");

  if (error) {
    throw error;
  }

  return data === true;
}

export interface SupabaseCreateWorkspaceParams {
  name: string;
  slug: string;
  ownerId: string;
  ownerEmail?: string | null;
  ownerName?: string | null;
}

/**
 * Server-side provisioning of a default workspace + owner membership on first
 * login. RLS has NO user insert policy on workspaces/workspace_members, so this
 * must run through the service-role client (never on the authenticated client).
 */
export async function createSupabaseWorkspaceWithOwner(
  params: SupabaseCreateWorkspaceParams,
): Promise<SupabaseWorkspaceSummary> {
  const admin = getSupabaseAdminClient();

  const baseSlug = params.slug || "workspace";
  let slug = baseSlug;
  let attempt = 0;

  let workspace: SupabaseWorkspaceSummary | null = null;
  while (!workspace) {
    const { data, error } = await admin
      .from("workspaces")
      .insert({ name: params.name, slug })
      .select("id,name,slug,description,logo,website,status,plan,created_at,updated_at")
      .single();

    if (error) {
      const isDuplicate = error.message.includes("duplicate") || error.message.includes("unique");
      if (attempt >= 10 || !isDuplicate) {
        throw error;
      }
      attempt += 1;
      const suffix = Math.random().toString(36).slice(2, 8);
      slug = `${baseSlug.slice(0, 56)}-${suffix}`;
      continue;
    }

    if (!data) {
      throw new Error("Failed to create workspace.");
    }

    const { error: memberError } = await admin.from("workspace_members").insert({
      workspace_id: data.id,
      user_id: params.ownerId,
      role: "owner",
      status: "active",
      email: params.ownerEmail ?? null,
      name: params.ownerName ?? null,
    });

    if (memberError) {
      throw memberError;
    }

    workspace = {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      logo: data.logo,
      website: data.website,
      status: data.status,
      plan: data.plan,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  return workspace;
}

const PLATFORM_SETTINGS_ID = "00000000-0000-0000-0000-00000000d002";

export interface SupabasePlatformSettings {
  id: string;
  platform_name: string | null;
  support_email: string | null;
  maintenance_mode: boolean | null;
  signup_enabled: boolean | null;
  default_workspace_plan: string | null;
  session_timeout_hours: number | null;
  require_2fa: boolean | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  from_email: string | null;
  date_created: string;
  date_updated: string;
}

/**
 * Reads the platform_settings singleton. RLS only allows authenticated users to
 * read it, but the (public) register page needs signup_enabled before auth, and
 * platform singletons are server-managed — so this uses the service-role client.
 * Only non-secret fields are returned; SMTP password / R2 credentials are never
 * exposed.
 */
export async function getSupabasePlatformSettings(): Promise<SupabasePlatformSettings | null> {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from("platform_settings")
    .select(
      "id,platform_name,support_email,maintenance_mode,signup_enabled,default_workspace_plan,session_timeout_hours,require_2fa,smtp_host,smtp_port,smtp_user,from_email,created_at,updated_at",
    )
    .eq("id", PLATFORM_SETTINGS_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    platform_name: data.platform_name,
    support_email: data.support_email,
    maintenance_mode: data.maintenance_mode,
    signup_enabled: data.signup_enabled,
    default_workspace_plan: data.default_workspace_plan,
    session_timeout_hours: data.session_timeout_hours,
    require_2fa: data.require_2fa,
    smtp_host: data.smtp_host,
    smtp_port: data.smtp_port,
    smtp_user: data.smtp_user,
    from_email: data.from_email,
    date_created: data.created_at,
    date_updated: data.updated_at,
  };
}

/**
 * Updates the platform_settings singleton (super-admin only, via the
 * service-role client). Secret fields (smtp_password, r2_*) may be written here
 * but are never returned by getSupabasePlatformSettings.
 */
export async function updateSupabasePlatformSettings(
  updates: Partial<{
    platform_name: string | null;
    support_email: string | null;
    maintenance_mode: boolean;
    signup_enabled: boolean;
    default_workspace_plan: string | null;
    session_timeout_hours: number | null;
    require_2fa: boolean;
    smtp_host: string | null;
    smtp_port: number | null;
    smtp_user: string | null;
    smtp_password: string | null;
    from_email: string | null;
    r2_account_id: string | null;
    r2_access_key_id: string | null;
    r2_access_key_secret: string | null;
    r2_bucket: string | null;
    r2_public_url: string | null;
  }>,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  // Upsert on the fixed singleton id so the first save creates the row
  // (the app must render defaults before any admin has ever saved settings).
  const { error } = await admin
    .from("platform_settings")
    .upsert({ id: PLATFORM_SETTINGS_ID, ...updates }, { onConflict: "id" });

  if (error) {
    throw error;
  }
}