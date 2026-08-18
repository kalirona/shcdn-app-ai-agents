"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveSecuritySettings } from "@/lib/auth/actions/admin/settings.actions";
import type { PlatformSettingsEntity } from "@/lib/db/entities";

interface Props {
  settings: PlatformSettingsEntity | null;
}

export function SecuritySection({ settings }: Props) {
  const [sessionTimeout, setSessionTimeout] = useState<number>(settings?.session_timeout_hours ?? 24);
  const [require2fa, setRequire2fa] = useState(settings?.require_2fa ?? false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await saveSecuritySettings({
        sessionTimeoutHours: sessionTimeout,
        require2fa,
      });
      if (result.ok) {
        toast.success("Security settings saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="session-timeout">Session timeout (hours)</Label>
          <Input
            id="session-timeout"
            type="number"
            min={1}
            max={8760}
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(Number(e.target.value))}
          />
          <p className="text-muted-foreground text-xs">
            How long a Directus session cookie remains valid before the user re-authenticates.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Require two-factor authentication</p>
          <p className="text-muted-foreground text-sm">Enforce 2FA across all platform administrators.</p>
        </div>
        <Switch checked={require2fa} onCheckedChange={setRequire2fa} />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
