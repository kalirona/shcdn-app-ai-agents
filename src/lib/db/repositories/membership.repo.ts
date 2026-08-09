import { db } from "../client";
import type { MembershipEntity } from "../entities";

export async function getWorkspaceMembers(workspaceId: string): Promise<MembershipEntity[]> {
  return db.membership.getByWorkspace(workspaceId);
}

export async function inviteWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: "admin" | "member",
): Promise<MembershipEntity> {
  return db.membership.create({
    workspace: workspaceId,
    user: userId,
    role,
  });
}

export async function removeWorkspaceMember(membershipId: string): Promise<void> {
  await db.membership.delete(membershipId);
}

export async function updateMemberRole(membershipId: string, role: "admin" | "member"): Promise<MembershipEntity> {
  return db.membership.update(membershipId, { role });
}

export async function getUserRole(workspaceId: string, userId: string): Promise<string | null> {
  const memberships = await db.membership.getByWorkspace(workspaceId);
  const membership = memberships.find((m) => m.user === userId);
  return membership?.role ?? null;
}
