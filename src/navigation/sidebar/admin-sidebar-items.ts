import { Building, DollarSign, FileText, LayoutDashboard, Settings, Users } from "lucide-react";

import type { NavGroup } from "./sidebar-items";

export const adminSidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "ADMIN",
    items: [
      {
        id: "admin-overview",
        title: "Overview",
        url: "/admin",
        icon: LayoutDashboard,
      },
      {
        id: "admin-users",
        title: "Users",
        url: "/admin/users",
        icon: Users,
      },
      {
        id: "admin-workspaces",
        title: "Workspaces",
        url: "/admin/workspaces",
        icon: Building,
      },
      {
        id: "admin-billing",
        title: "Billing",
        url: "/admin/billing",
        icon: DollarSign,
      },
      {
        id: "admin-audit",
        title: "Audit Logs",
        url: "/admin/audit",
        icon: FileText,
      },
      {
        id: "admin-settings",
        title: "Settings",
        url: "/admin/settings",
        icon: Settings,
      },
    ],
  },
];

export const ADMIN_NAV_LABEL = "Platform Admin";
