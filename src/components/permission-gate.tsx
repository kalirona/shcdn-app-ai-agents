"use client";

import { ReactNode } from "react";

import {
  hasPermission,
  PERMISSIONS,
  type Permission,
  type Role,
} from "@/lib/auth/roles";

interface PermissionGateProps {
  permission: Permission;
  role: Role;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ permission, role, children, fallback = null }: PermissionGateProps) {
  if (hasPermission(role, permission)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}

interface RoleGateProps {
  allowedRoles: Role[];
  role: Role;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGate({ allowedRoles, role, children, fallback = null }: RoleGateProps) {
  if (allowedRoles.includes(role)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}

export { PERMISSIONS };
export type { Permission, Role };
