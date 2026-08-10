export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.OWNER]: "Owner",
  [ROLES.ADMIN]: "Admin",
  [ROLES.MEMBER]: "Member",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [ROLES.OWNER]: "Full control — billing, team, settings, delete workspace",
  [ROLES.ADMIN]: "Manage agents, knowledge, conversations, invite members",
  [ROLES.MEMBER]: "Create agents, add knowledge, view conversations",
};

export const PERMISSIONS = {
  AGENTS_CREATE: "agents:create",
  AGENTS_READ: "agents:read",
  AGENTS_UPDATE: "agents:update",
  AGENTS_DELETE: "agents:delete",

  KNOWLEDGE_CREATE: "knowledge:create",
  KNOWLEDGE_READ: "knowledge:read",
  KNOWLEDGE_UPDATE: "knowledge:update",
  KNOWLEDGE_DELETE: "knowledge:delete",

  CONVERSATIONS_READ: "conversations:read",
  CONVERSATIONS_EXPORT: "conversations:export",

  LEADS_READ: "leads:read",
  LEADS_MANAGE: "leads:manage",

  ANALYTICS_READ: "analytics:read",

  MEMBERS_INVITE: "members:invite",
  MEMBERS_REMOVE: "members:remove",
  MEMBERS_CHANGE_ROLE: "members:change_role",

  BILLING_MANAGE: "billing:manage",
  SETTINGS_UPDATE: "settings:update",
  WORKSPACE_DELETE: "workspace:delete",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.OWNER]: Object.values(PERMISSIONS),

  [ROLES.ADMIN]: [
    PERMISSIONS.AGENTS_CREATE,
    PERMISSIONS.AGENTS_READ,
    PERMISSIONS.AGENTS_UPDATE,
    PERMISSIONS.AGENTS_DELETE,
    PERMISSIONS.KNOWLEDGE_CREATE,
    PERMISSIONS.KNOWLEDGE_READ,
    PERMISSIONS.KNOWLEDGE_UPDATE,
    PERMISSIONS.KNOWLEDGE_DELETE,
    PERMISSIONS.CONVERSATIONS_READ,
    PERMISSIONS.CONVERSATIONS_EXPORT,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_MANAGE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.MEMBERS_INVITE,
    PERMISSIONS.MEMBERS_REMOVE,
    PERMISSIONS.MEMBERS_CHANGE_ROLE,
    PERMISSIONS.SETTINGS_UPDATE,
  ],

  [ROLES.MEMBER]: [
    PERMISSIONS.AGENTS_CREATE,
    PERMISSIONS.AGENTS_READ,
    PERMISSIONS.AGENTS_UPDATE,
    PERMISSIONS.KNOWLEDGE_CREATE,
    PERMISSIONS.KNOWLEDGE_READ,
    PERMISSIONS.CONVERSATIONS_READ,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canInvite(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.MEMBERS_INVITE);
}

export function canManageBilling(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.BILLING_MANAGE);
}
