export const ROLES = {
  SUPER_ADMIN: "super_admin",
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
  VIEWER: "viewer",
  SUPPORT: "support",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.OWNER]: "Owner",
  [ROLES.ADMIN]: "Admin",
  [ROLES.MEMBER]: "Member",
  [ROLES.VIEWER]: "Viewer",
  [ROLES.SUPPORT]: "Support",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: "Full access to all workspaces and platform settings",
  [ROLES.OWNER]: "Full control over the workspace, including billing and deletion",
  [ROLES.ADMIN]: "Can manage agents, members, and settings except billing",
  [ROLES.MEMBER]: "Can create and manage own agents, view conversations",
  [ROLES.VIEWER]: "Read-only access to agents and conversations",
  [ROLES.SUPPORT]: "Read-only access to any workspace for customer support",
};

export const PERMISSIONS = {
  AGENTS_CREATE: "agents:create",
  AGENTS_READ: "agents:read",
  AGENTS_UPDATE: "agents:update",
  AGENTS_DELETE: "agents:delete",
  AGENTS_UPDATE_ANY: "agents:update:any",
  AGENTS_DELETE_ANY: "agents:delete:any",

  CONVERSATIONS_READ: "conversations:read",
  CONVERSATIONS_EXPORT: "conversations:export",
  CONVERSATIONS_DELETE: "conversations:delete",

  LEADS_READ: "leads:read",
  LEADS_CREATE: "leads:create",
  LEADS_UPDATE: "leads:update",
  LEADS_DELETE: "leads:delete",

  CUSTOMERS_READ: "customers:read",
  CUSTOMERS_CREATE: "customers:create",
  CUSTOMERS_UPDATE: "customers:update",
  CUSTOMERS_DELETE: "customers:delete",

  QUOTES_READ: "quotes:read",
  QUOTES_CREATE: "quotes:create",
  QUOTES_UPDATE: "quotes:update",
  QUOTES_DELETE: "quotes:delete",

  BOOKINGS_READ: "bookings:read",
  BOOKINGS_CREATE: "bookings:create",
  BOOKINGS_UPDATE: "bookings:update",
  BOOKINGS_DELETE: "bookings:delete",

  ANALYTICS_READ: "analytics:read",

  MEMBERS_INVITE: "members:invite",
  MEMBERS_REMOVE: "members:remove",
  MEMBERS_CHANGE_ROLE: "members:change_role",
  MEMBERS_READ: "members:read",

  SETTINGS_READ: "settings:read",
  SETTINGS_UPDATE: "settings:update",

  BILLING_READ: "billing:read",
  BILLING_MANAGE: "billing:manage",

  WORKSPACE_DELETE: "workspace:delete",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),

  [ROLES.OWNER]: Object.values(PERMISSIONS),

  [ROLES.ADMIN]: [
    PERMISSIONS.AGENTS_CREATE,
    PERMISSIONS.AGENTS_READ,
    PERMISSIONS.AGENTS_UPDATE,
    PERMISSIONS.AGENTS_DELETE,
    PERMISSIONS.AGENTS_UPDATE_ANY,
    PERMISSIONS.AGENTS_DELETE_ANY,
    PERMISSIONS.CONVERSATIONS_READ,
    PERMISSIONS.CONVERSATIONS_EXPORT,
    PERMISSIONS.CONVERSATIONS_DELETE,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_CREATE,
    PERMISSIONS.LEADS_UPDATE,
    PERMISSIONS.LEADS_DELETE,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.CUSTOMERS_DELETE,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.QUOTES_CREATE,
    PERMISSIONS.QUOTES_UPDATE,
    PERMISSIONS.QUOTES_DELETE,
    PERMISSIONS.BOOKINGS_READ,
    PERMISSIONS.BOOKINGS_CREATE,
    PERMISSIONS.BOOKINGS_UPDATE,
    PERMISSIONS.BOOKINGS_DELETE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.MEMBERS_INVITE,
    PERMISSIONS.MEMBERS_REMOVE,
    PERMISSIONS.MEMBERS_CHANGE_ROLE,
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_UPDATE,
    PERMISSIONS.BILLING_READ,
  ],

  [ROLES.MEMBER]: [
    PERMISSIONS.AGENTS_CREATE,
    PERMISSIONS.AGENTS_READ,
    PERMISSIONS.AGENTS_UPDATE,
    PERMISSIONS.CONVERSATIONS_READ,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_CREATE,
    PERMISSIONS.LEADS_UPDATE,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.QUOTES_CREATE,
    PERMISSIONS.QUOTES_UPDATE,
    PERMISSIONS.BOOKINGS_READ,
    PERMISSIONS.BOOKINGS_CREATE,
    PERMISSIONS.BOOKINGS_UPDATE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.SETTINGS_READ,
  ],

  [ROLES.VIEWER]: [
    PERMISSIONS.AGENTS_READ,
    PERMISSIONS.CONVERSATIONS_READ,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.BOOKINGS_READ,
    PERMISSIONS.MEMBERS_READ,
  ],

  [ROLES.SUPPORT]: [
    PERMISSIONS.AGENTS_READ,
    PERMISSIONS.CONVERSATIONS_READ,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.BOOKINGS_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.BILLING_READ,
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function getRoleHierarchy(): Role[] {
  return [
    ROLES.SUPER_ADMIN,
    ROLES.OWNER,
    ROLES.ADMIN,
    ROLES.MEMBER,
    ROLES.VIEWER,
    ROLES.SUPPORT,
  ];
}

export function isRoleAtLeast(role: Role, minRole: Role): boolean {
  const hierarchy = getRoleHierarchy();
  const roleIdx = hierarchy.indexOf(role);
  const minIdx = hierarchy.indexOf(minRole);
  return roleIdx <= minIdx;
}

export function canManageRole(managerRole: Role, targetRole: Role): boolean {
  if (managerRole === ROLES.SUPER_ADMIN) return true;
  if (managerRole === ROLES.OWNER) return targetRole !== ROLES.SUPER_ADMIN;
  if (managerRole === ROLES.ADMIN) {
    return [ROLES.MEMBER, ROLES.VIEWER].includes(targetRole as typeof ROLES.MEMBER | typeof ROLES.VIEWER);
  }
  return false;
}

export function getAssignableRoles(managerRole: Role): Role[] {
  if (managerRole === ROLES.SUPER_ADMIN) {
    return [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER, ROLES.VIEWER];
  }
  if (managerRole === ROLES.OWNER) {
    return [ROLES.ADMIN, ROLES.MEMBER, ROLES.VIEWER];
  }
  if (managerRole === ROLES.ADMIN) {
    return [ROLES.MEMBER, ROLES.VIEWER];
  }
  return [];
}
