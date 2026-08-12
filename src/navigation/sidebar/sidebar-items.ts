import {
  BarChart3,
  Bot,
  Calendar,
  DollarSign,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  Puzzle,
  Settings,
  Users,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Overview",
    items: [
      {
        id: "dashboard",
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 2,
    label: "Agent",
    items: [
      {
        id: "agents",
        title: "My Agents",
        url: "/dashboard/agents",
        icon: Bot,
      },
      {
        id: "conversations",
        title: "Conversations",
        url: "/dashboard/conversations",
        icon: MessageSquare,
      },
    ],
  },
  {
    id: 3,
    label: "CRM",
    items: [
      {
        id: "leads",
        title: "Leads",
        url: "/dashboard/leads",
        icon: Users,
      },
      {
        id: "customers",
        title: "Customers",
        url: "/dashboard/crm/customers",
        icon: Users,
      },
      {
        id: "quotes",
        title: "Quotes",
        url: "/dashboard/crm/quotes",
        icon: DollarSign,
      },
      {
        id: "bookings",
        title: "Bookings",
        url: "/dashboard/bookings",
        icon: Calendar,
      },
    ],
  },
  {
    id: 4,
    label: "Insights",
    items: [
      {
        id: "analytics",
        title: "Analytics",
        url: "/dashboard/analytics",
        icon: BarChart3,
      },
    ],
  },
  {
    id: 5,
    label: "Settings",
    items: [
      {
        id: "integrations",
        title: "Integrations",
        url: "/dashboard/integrations",
        icon: Puzzle,
      },
      {
        id: "settings",
        title: "Settings",
        url: "/dashboard/settings",
        icon: Settings,
      },
    ],
  },
];
