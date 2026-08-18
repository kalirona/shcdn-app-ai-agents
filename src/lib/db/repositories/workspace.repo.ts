import {
  createSupabaseWorkspaceWithOwner,
  getSupabaseAllWorkspaces,
  getSupabaseUserWorkspaces,
  type SupabaseWorkspaceSummary,
} from "@/lib/auth/supabase-identity";
import { isSupabase } from "@/lib/auth/provider";

import { db } from "../client";
import type { WorkspaceEntity } from "../entities";

export interface CreateWorkspaceParams {
  name: string;
  slug: string;
  description?: string;
  website?: string;
  ownerId: string;
  ownerEmail?: string | null;
  ownerName?: string | null;
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function toWorkspaceEntity(workspace: SupabaseWorkspaceSummary): WorkspaceEntity {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description ?? null,
    logo: workspace.logo ?? null,
    website: workspace.website ?? null,
    status: (workspace.status as WorkspaceEntity["status"]) ?? "active",
    plan: (workspace.plan as WorkspaceEntity["plan"]) ?? "starter",
    subscription_status: "free",
    payment_provider: null,
    payment_provider_subscription_id: null,
    payment_provider_customer_id: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    date_created: workspace.createdAt,
    date_updated: workspace.updatedAt,
  };
}

export async function createWorkspaceWithOwner(params: CreateWorkspaceParams) {
  if (isSupabase()) {
    const baseSlug = slugifyName(params.slug) || "workspace";
    const created = await createSupabaseWorkspaceWithOwner({
      name: params.name,
      slug: baseSlug,
      ownerId: params.ownerId,
      ownerEmail: params.ownerEmail ?? null,
      ownerName: params.ownerName ?? null,
    });
    return toWorkspaceEntity(created);
  }

  const baseSlug = slugifyName(params.slug) || "workspace";

  // Ensure a unique slug even if another workspace already used it
  // (e.g. two users both named "John"). Retry with a numeric suffix.
  let slug = baseSlug;
  let attempt = 0;
  let workspace = null;
  while (!workspace) {
    try {
      workspace = await db.workspace.create({
        name: params.name,
        slug,
        description: params.description ?? null,
        logo: null,
        website: params.website ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const isDuplicate =
        message.includes("duplicate") || message.includes("unique") || message.includes("already exists");
      if (attempt >= 10 || !isDuplicate) {
        throw error;
      }
      attempt += 1;
      const suffix = Math.random().toString(36).slice(2, 8);
      slug = `${baseSlug.slice(0, 56)}-${suffix}`;
    }
  }

  await db.membership.create({
    workspace: workspace.id,
    user: params.ownerId,
    role: "owner",
    email: params.ownerEmail ?? null,
    name: params.ownerName ?? null,
  });

  return workspace;
}

export async function getUserWorkspaces(userId: string): Promise<WorkspaceEntity[]> {
  if (isSupabase()) {
    const workspaces = await getSupabaseUserWorkspaces(userId);
    return workspaces.map(toWorkspaceEntity);
  }

  const memberships = await db.membership.getByUser(userId);
  const workspaceIds = memberships.map((m) => m.workspace);

  if (workspaceIds.length === 0) {
    return [];
  }

  const workspaces = await db.workspace.getMany({
    filter: { id: { _in: workspaceIds } },
    sort: ["-date_created"],
  });

  return workspaces;
}

export async function getWorkspaceById(id: string): Promise<WorkspaceEntity | null> {
  try {
    return await db.workspace.getById(id);
  } catch {
    return null;
  }
}

export async function updateWorkspace(
  id: string,
  data: { name?: string; description?: string; website?: string },
): Promise<WorkspaceEntity> {
  return db.workspace.update(id, {
    name: data.name,
    description: data.description,
    website: data.website,
  });
}

export async function deleteWorkspace(id: string): Promise<void> {
  await db.workspace.delete(id);
}

export async function getAllWorkspaces(): Promise<WorkspaceEntity[]> {
  if (isSupabase()) {
    const workspaces = await getSupabaseAllWorkspaces();
    return workspaces.map(toWorkspaceEntity);
  }
  return db.workspace.getMany({
    sort: ["-date_created"],
  });
}

export async function getWorkspacesByPlan(plan: string): Promise<WorkspaceEntity[]> {
  return db.workspace.getMany({
    filter: { plan: { _eq: plan } },
    sort: ["-date_created"],
  });
}

export async function getWorkspacesBySubscriptionStatus(status: string): Promise<WorkspaceEntity[]> {
  return db.workspace.getMany({
    filter: { subscription_status: { _eq: status } },
    sort: ["-date_created"],
  });
}
