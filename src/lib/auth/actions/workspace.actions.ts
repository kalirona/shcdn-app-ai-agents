"use server";

import { revalidatePath } from "next/cache";

import type { z } from "zod";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { PERMISSIONS } from "@/lib/auth/roles";
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  removeMemberSchema,
  updateMemberRoleSchema,
  updateWorkspaceSchema,
} from "@/lib/auth/schemas/workspace.schema";
import { enforceTeamMemberLimit } from "@/lib/billing/usage-enforcement";
import * as membershipRepo from "@/lib/db/repositories/membership.repo";
import * as workspaceRepo from "@/lib/db/repositories/workspace.repo";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function createWorkspace(data: z.infer<typeof createWorkspaceSchema>) {
  const parsed = createWorkspaceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name, description, website } = parsed.data;
  const slug = generateSlug(name);

  if (!slug) {
    return { error: "Invalid workspace name." };
  }

  try {
    // requireWorkspaceAccess needs a workspace id, so creating a new workspace
    // is gated by plain authentication instead (handled inside the repo path).
    const { getAuthContext } = await import("@/lib/auth/auth-context");
    const { isAuthenticated, user } = await getAuthContext();
    if (!isAuthenticated || !user?.id) {
      return { error: "Unauthorized: You must be logged in." };
    }

    const workspace = await workspaceRepo.createWorkspaceWithOwner({
      name,
      slug,
      description,
      website: website || undefined,
      ownerId: user.id,
    });

    revalidatePath("/dashboard");
    return { success: true, workspace };
  } catch (error) {
    console.error("Failed to create workspace:", error);
    return { error: "Failed to create workspace. Please try again." };
  }
}

export async function updateWorkspace(workspaceId: string, data: z.infer<typeof updateWorkspaceSchema>) {
  const parsed = updateWorkspaceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await requireWorkspaceAccess(workspaceId, PERMISSIONS.SETTINGS_UPDATE);
    await workspaceRepo.updateWorkspace(workspaceId, parsed.data);
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to update workspace:", error);
    return { error: "Failed to update workspace. Please try again." };
  }
}

export async function inviteMember(workspaceId: string, data: z.infer<typeof inviteMemberSchema>) {
  const parsed = inviteMemberSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await requireWorkspaceAccess(workspaceId, PERMISSIONS.MEMBERS_INVITE);

    const existing = await membershipRepo.getWorkspaceMembers(workspaceId);
    if (existing.some((m) => m.user === parsed.data.email)) {
      return { error: "That user is already a member of this workspace." };
    }

    const limitCheck = await enforceTeamMemberLimit(workspaceId);
    if (!limitCheck.allowed) {
      return { error: limitCheck.error ?? "Team member limit reached." };
    }

    // Memberships are keyed by Logto user id. For invites we store the target
    // email as the identifier with status "invited"; it is linked to the real
    // Logto sub when that user signs in.
    await membershipRepo.inviteWorkspaceMember(workspaceId, parsed.data.email, parsed.data.role);

    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to invite member:", error);
    return { error: "Failed to invite member. Please try again." };
  }
}

export async function removeMember(workspaceId: string, data: z.infer<typeof removeMemberSchema>) {
  const parsed = removeMemberSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const access = await requireWorkspaceAccess(workspaceId, PERMISSIONS.MEMBERS_REMOVE);

    const membership = await membershipRepo.getMembershipById(parsed.data.membershipId);
    if (!membership) {
      return { error: "Membership not found." };
    }
    if (membership.role === "owner") {
      return { error: "You cannot remove the workspace owner." };
    }
    if (membership.user === access.userId) {
      return { error: "You cannot remove yourself." };
    }

    await membershipRepo.removeWorkspaceMember(parsed.data.membershipId);
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to remove member:", error);
    return { error: "Failed to remove member. Please try again." };
  }
}

export async function updateMemberRole(workspaceId: string, data: z.infer<typeof updateMemberRoleSchema>) {
  const parsed = updateMemberRoleSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const access = await requireWorkspaceAccess(workspaceId, PERMISSIONS.MEMBERS_CHANGE_ROLE);

    const membership = await membershipRepo.getMembershipById(parsed.data.membershipId);
    if (!membership) {
      return { error: "Membership not found." };
    }
    if (membership.role === "owner") {
      return { error: "You cannot change the workspace owner's role." };
    }
    if (membership.user === access.userId) {
      return { error: "You cannot change your own role." };
    }

    await membershipRepo.updateMemberRole(parsed.data.membershipId, parsed.data.role);
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to update member role:", error);
    return { error: "Failed to update member role. Please try again." };
  }
}

export async function getWorkspaceMembers(workspaceId: string) {
  try {
    await requireWorkspaceAccess(workspaceId, PERMISSIONS.MEMBERS_INVITE);
    const members = await membershipRepo.getWorkspaceMembers(workspaceId);
    return { success: true, members };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message, members: [] };
    }
    console.error("Failed to fetch members:", error);
    return { error: "Failed to load members.", members: [] };
  }
}

export async function getUserWorkspaces() {
  try {
    const { getAuthContext } = await import("@/lib/auth/auth-context");
    const { isAuthenticated, user } = await getAuthContext();
    if (!isAuthenticated || !user?.id) {
      return { error: "Unauthorized: You must be logged in.", workspaces: [] };
    }

    const workspaces = await workspaceRepo.getUserWorkspaces(user.id);
    return { success: true, workspaces };
  } catch (error) {
    console.error("Failed to fetch workspaces:", error);
    return { error: "Failed to load workspaces.", workspaces: [] };
  }
}
