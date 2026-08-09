"use client";

import { CreditCard, Settings as SettingsIcon, Shield, Users } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillingTab } from "./_components/billing-tab";
import { BusinessProfileForm } from "./_components/business-profile-form";
import { RoleManagement } from "./_components/role-management";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your workspace, team members, and billing.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
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
      </Tabs>
    </div>
  );
}
