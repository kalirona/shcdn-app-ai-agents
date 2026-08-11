"use client";

import { AlertTriangle, Bell, CreditCard, KeyRound, Puzzle, Settings as SettingsIcon, Users } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ApiKeysTab } from "./_components/api-keys-tab";
import { BillingTab } from "./_components/billing-tab";
import { BusinessProfileForm } from "./_components/business-profile-form";
import { DangerZoneTab } from "./_components/danger-zone-tab";
import { IntegrationsTab } from "./_components/integrations-tab";
import { NotificationsTab } from "./_components/notifications-tab";
import { RoleManagement } from "./_components/role-management";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your workspace, team, billing, and integrations.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">
            <SettingsIcon />
            Business Profile
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users />
            Members & Roles
          </TabsTrigger>
          <TabsTrigger value="billing">
            <CreditCard />
            Billing
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Puzzle />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="api-keys">
            <KeyRound />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="danger-zone">
            <AlertTriangle />
            Danger Zone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <BusinessProfileForm />
        </TabsContent>
        <TabsContent value="members">
          <RoleManagement />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="api-keys">
          <ApiKeysTab />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="danger-zone">
          <DangerZoneTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
