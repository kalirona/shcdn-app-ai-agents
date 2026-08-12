export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.OWNER]: "Owner",
  [ROLES.ADMIN]: "Manager",
  [ROLES.MEMBER]: "Agent",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [ROLES.OWNER]: "Full control - billing, members, organization settings, delete workspace",
  [ROLES.ADMIN]: "Manage agents, knowledge, conversations, leads, and bookings",
  [ROLES.MEMBER]: "View conversations, take over chats, and see relevant customer information",
};

// Platform-level role (separate from workspace roles)
export const PLATFORM_ROLES = {
  SUPER_ADMIN: "super_admin",
} as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[keyof typeof PLATFORM_ROLES];

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
  CONVERSATIONS_TAKEOVER: "conversations:takeover",

  LEADS_READ: "leads:read",
  LEADS_MANAGE: "leads:manage",

  CUSTOMERS_READ: "customers:read",
  BOOKINGS_MANAGE: "bookings:manage",

  ANALYTICS_READ: "analytics:read",

  MEMBERS_INVITE: "members:invite",
  MEMBERS_REMOVE: "members:remove",
  MEMBERS_CHANGE_ROLE: "members:change_role",

  BILLING_MANAGE: "billing:manage",
  SETTINGS_UPDATE: "settings:update",
  WORKSPACE_DELETE: "workspace:delete",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PLATFORM_PERMISSIONS = {
  PLATFORM_USERS_READ: "platform:users:read",
  PLATFORM_USERS_MANAGE: "platform:users:manage",
  PLATFORM_WORKSPACES_READ: "platform:workspaces:read",
  PLATFORM_WORKSPACES_MANAGE: "platform:workspaces:manage",
  PLATFORM_BILLING_READ: "platform:billing:read",
  PLATFORM_BILLING_MANAGE: "platform:billing:manage",
  PLATFORM_AUDIT_READ: "platform:audit:read",
  PLATFORM_SETTINGS_MANAGE: "platform:settings:manage",
} as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];

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
    PERMISSIONS.CONVERSATIONS_TAKEOVER,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_MANAGE,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.SETTINGS_UPDATE,
  ],

  [ROLES.MEMBER]: [
    PERMISSIONS.CONVERSATIONS_READ,
    PERMISSIONS.CONVERSATIONS_TAKEOVER,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],
};

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, PlatformPermission[]> = {
  [PLATFORM_ROLES.SUPER_ADMIN]: Object.values(PLATFORM_PERMISSIONS),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasPlatformPermission(role: PlatformRole, permission: PlatformPermission): boolean {
  return PLATFORM_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canInvite(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.MEMBERS_INVITE);
}

export function canManageBilling(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.BILLING_MANAGE);
}

export function canManageAgents(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.AGENTS_CREATE) || hasPermission(role, PERMISSIONS.AGENTS_UPDATE);
}
