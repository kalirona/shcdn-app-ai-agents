"use server";

import { revalidatePath } from "next/cache";

import type { z } from "zod";

import { getAuthContext } from "@/lib/auth/auth-context";
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  removeMemberSchema,
  updateMemberRoleSchema,
  updateWorkspaceSchema,
} from "@/lib/auth/schemas/workspace.schema";
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

async function requireAuth() {
  const { isAuthenticated, user } = await getAuthContext();
  if (!isAuthenticated || !user) {
    throw new Error("Unauthorized: You must be logged in.");
  }
  return user;
}

export async function createWorkspace(data: z.infer<typeof createWorkspaceSchema>) {
  const user = await requireAuth();

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
  await requireAuth();

  const parsed = updateWorkspaceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await workspaceRepo.updateWorkspace(workspaceId, parsed.data);
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to update workspace:", error);
    return { error: "Failed to update workspace. Please try again." };
  }
}

export async function inviteMember(_workspaceId: string, data: z.infer<typeof inviteMemberSchema>) {
  await requireAuth();

  const parsed = inviteMemberSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    // TODO: Look up user by email in Logto/Directus, then create membership
    // const targetUser = await findUserByEmail(parsed.data.email);
    // await membershipRepo.inviteWorkspaceMember(workspaceId, targetUser.id, parsed.data.role);
    // TODO: Send invitation email via Resend

    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to invite member:", error);
    return { error: "Failed to invite member. Please try again." };
  }
}

export async function removeMember(_workspaceId: string, data: z.infer<typeof removeMemberSchema>) {
  await requireAuth();

  const parsed = removeMemberSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await membershipRepo.removeWorkspaceMember(parsed.data.membershipId);
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to remove member:", error);
    return { error: "Failed to remove member. Please try again." };
  }
}

export async function updateMemberRole(_workspaceId: string, data: z.infer<typeof updateMemberRoleSchema>) {
  await requireAuth();

  const parsed = updateMemberRoleSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await membershipRepo.updateMemberRole(parsed.data.membershipId, parsed.data.role);
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to update member role:", error);
    return { error: "Failed to update member role. Please try again." };
  }
}

export async function getUserWorkspaces() {
  const user = await requireAuth();

  try {
    const workspaces = await workspaceRepo.getUserWorkspaces(user.id);
    return { success: true, workspaces };
  } catch (error) {
    console.error("Failed to fetch workspaces:", error);
    return { error: "Failed to load workspaces.", workspaces: [] };
  }
}
