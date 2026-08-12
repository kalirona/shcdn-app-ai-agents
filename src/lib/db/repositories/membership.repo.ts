import { db } from "../client";
import type { MembershipEntity } from "../entities";

export async function getWorkspaceMembers(workspaceId: string): Promise<MembershipEntity[]> {
  return db.membership.getByWorkspace(workspaceId);
}

export async function getMembershipById(membershipId: string): Promise<MembershipEntity | null> {
  try {
    return await db.membership.getById(membershipId);
  } catch {
    return null;
  }
}

export async function inviteWorkspaceMember(
  workspaceId: string,
  user: string,
  role: "admin" | "member",
  email?: string,
  name?: string,
): Promise<MembershipEntity> {
  return db.membership.create({
    workspace: workspaceId,
    user,
    role,
    email: email ?? user,
    name: name ?? null,
    status: "invited",
  });
}

export async function removeWorkspaceMember(membershipId: string): Promise<void> {
  await db.membership.delete(membershipId);
}

export async function updateMemberRole(membershipId: string, role: "admin" | "member"): Promise<MembershipEntity> {
  return db.membership.update(membershipId, { role });
}

/** Re-stamps a pending invite so it can be re-sent. Only valid for invited memberships. */
export async function resendWorkspaceInvite(membershipId: string): Promise<MembershipEntity> {
  return db.membership.update(membershipId, { status: "invited" });
}

export async function getUserRole(workspaceId: string, userId: string): Promise<string | null> {
  const memberships = await db.membership.getByWorkspace(workspaceId);
  const membership = memberships.find((m) => m.user === userId);
  return membership?.role ?? null;
}

/** Finds an invited membership by email so it can be activated on sign-in. */
export async function findInviteByEmail(email: string): Promise<MembershipEntity | null> {
  const memberships = await db.membership.getByUser(email);
  return memberships.find((m) => m.status === "invited") ?? null;
}

/** Activates an invited membership, linking it to the real Logto user id. */
export async function activateInvite(membershipId: string, userId: string): Promise<MembershipEntity> {
  return db.membership.update(membershipId, { user: userId, status: "active" });
}
