"use server";

import { getAuthContext } from "@/lib/auth/auth-context";
import { createWorkspaceWithOwner, getUserWorkspaces } from "@/lib/db/repositories/workspace.repo";

export interface CurrentUserResult {
  user: { id: string; email: string; name: string | null; avatar: string | null };
  workspaces: { id: string; name: string; slug: string }[];
  currentWorkspace: { id: string; name: string; slug: string } | null;
}

function toWorkspaceSummary(workspace: { id: string; name: string; slug: string }) {
  return { id: workspace.id, name: workspace.name, slug: workspace.slug };
}

export async function getCurrentUser(): Promise<CurrentUserResult> {
  const { isAuthenticated, user } = await getAuthContext();

  if (!isAuthenticated || !user) {
    return { user: { id: "", email: "", name: null, avatar: null }, workspaces: [], currentWorkspace: null };
  }

  let workspaces = await getUserWorkspaces(user.id);

  // Auto-provision a default workspace + owner membership for brand-new users
  // so the dashboard always has a real organization tied to the authenticated user.
  if (workspaces.length === 0) {
    const baseName = user.name?.trim() ? user.name.trim() : user.email.split("@")[0] ?? "My";
    const slug = `${baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-workspace`.slice(0, 64);
    try {
      const created = await createWorkspaceWithOwner({
        name: `${baseName}'s Workspace`,
        slug,
        ownerId: user.id,
      });
      workspaces = [created];
    } catch {
      // Directus may not be reachable in local dev — proceed with empty workspaces.
    }
  }

  const summaries = workspaces.map(toWorkspaceSummary);

  return {
    user,
    workspaces: summaries,
    currentWorkspace: summaries[0] ?? null,
  };
}
