import { db } from "../client";
import type { WorkspaceEntity } from "../entities";

export interface CreateWorkspaceParams {
  name: string;
  slug: string;
  description?: string;
  website?: string;
  ownerId: string;
}

export async function createWorkspaceWithOwner(params: CreateWorkspaceParams) {
  const workspace = await db.workspace.create({
    name: params.name,
    slug: params.slug,
    description: params.description ?? null,
    logo: null,
    website: params.website ?? null,
  });

  await db.membership.create({
    workspace: workspace.id,
    user: params.ownerId,
    role: "owner",
  });

  return workspace;
}

export async function getUserWorkspaces(userId: string): Promise<WorkspaceEntity[]> {
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
