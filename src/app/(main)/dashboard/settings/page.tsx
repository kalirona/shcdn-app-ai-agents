"use client";

import { useState } from "react";

import {
  AlertTriangle,
  Bell,
  CreditCard,
  KeyRound,
  Puzzle,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { ApiKeysTab } from "./_components/api-keys-tab";
import { BillingTab } from "./_components/billing-tab";
import { BusinessProfileForm } from "./_components/business-profile-form";
import { DangerZoneTab } from "./_components/danger-zone-tab";
import { IntegrationsTab } from "./_components/integrations-tab";
import { NotificationsTab } from "./_components/notifications-tab";
import { RoleManagement } from "./_components/role-management";

const navSections = [
  {
    label: "Workspace",
    items: [
      { value: "profile", label: "Business Profile", icon: SettingsIcon },
      { value: "members", label: "Members & Roles", icon: Users },
      { value: "billing", label: "Billing", icon: CreditCard },
      { value: "integrations", label: "Integrations", icon: Puzzle },
      { value: "api-keys", label: "API Keys", icon: KeyRound },
      { value: "notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: null,
    items: [{ value: "danger-zone", label: "Danger Zone", icon: AlertTriangle }],
  },
] as const;

type NavValue = (typeof navSections)[number]["items"][number]["value"];

const content: Record<NavValue, () => React.JSX.Element> = {
  profile: BusinessProfileForm,
  members: RoleManagement,
  billing: BillingTab,
  integrations: IntegrationsTab,
  "api-keys": ApiKeysTab,
  notifications: NotificationsTab,
  "danger-zone": DangerZoneTab,
};

export default function SettingsPage() {
  const [active, setActive] = useState<NavValue>("profile");
  const ActiveContent = content[active];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your workspace, team, billing, and integrations.</p>
      </div>

      <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 gap-1 overflow-x-auto pb-1 md:w-52 md:flex-col md:gap-0 md:overflow-visible md:pb-0"
        >
          {navSections.map((section, sectionIndex) => (
            <div
              key={section.label ?? sectionIndex}
              className={cn(
                "flex shrink-0 gap-1 md:flex-col md:gap-0.5",
                sectionIndex > 0 && "md:mt-4 md:border-t md:pt-4"
              )}
            >
              {section.label && (
                <div className="hidden px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider md:block">
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setActive(item.value)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                      "text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isActive && "bg-muted text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <main className="min-w-0 flex-1 space-y-4">
          <ActiveContent />
        </main>
      </div>
    </div>
  );
}
