export type WorkspaceRole = "owner" | "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  email: string;
  name: string | null;
  avatar: string | null;
  joinedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  forcePasswordReset: boolean;
}

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Manager",
  member: "Agent",
};
