"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveGeneralSettings } from "@/lib/auth/actions/admin/settings.actions";
import type { PlatformSettingsEntity } from "@/lib/db/entities";

interface Props {
  settings: PlatformSettingsEntity | null;
}

export function GeneralSection({ settings }: Props) {
  const [platformName, setPlatformName] = useState(settings?.platform_name ?? "Agent AI");
  const [supportEmail, setSupportEmail] = useState(settings?.support_email ?? "");
  const [maintenanceMode, setMaintenanceMode] = useState(settings?.maintenance_mode ?? false);
  const [signupEnabled, setSignupEnabled] = useState(settings?.signup_enabled ?? true);
  const [defaultPlan, setDefaultPlan] = useState(settings?.default_workspace_plan ?? "starter");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await saveGeneralSettings({
        platformName,
        supportEmail,
        maintenanceMode,
        signupEnabled,
        defaultWorkspacePlan: defaultPlan,
      });
      if (result.ok) {
        toast.success("General settings saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="platform-name">Platform name</Label>
          <Input
            id="platform-name"
            value={platformName}
            onChange={(e) => setPlatformName(e.target.value)}
            placeholder="Agent AI"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-email">Support email</Label>
          <Input
            id="support-email"
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="support@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="default-plan">Default workspace plan</Label>
          <Input
            id="default-plan"
            value={defaultPlan}
            onChange={(e) => setDefaultPlan(e.target.value)}
            placeholder="starter"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Allow new signups</p>
            <p className="text-muted-foreground text-sm">Let new users create workspaces.</p>
          </div>
          <Switch checked={signupEnabled} onCheckedChange={setSignupEnabled} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Maintenance mode</p>
            <p className="text-muted-foreground text-sm">Show a maintenance notice instead of the public app.</p>
          </div>
          <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
