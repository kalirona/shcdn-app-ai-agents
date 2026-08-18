"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveEmailSettings } from "@/lib/auth/actions/admin/settings.actions";
import type { PlatformSettingsEntity } from "@/lib/db/entities";

interface Props {
  settings: PlatformSettingsEntity | null;
}

export function EmailSection({ settings }: Props) {
  const [smtpHost, setSmtpHost] = useState(settings?.smtp_host ?? "");
  const [smtpPort, setSmtpPort] = useState<number | null>(settings?.smtp_port ?? null);
  const [smtpUser, setSmtpUser] = useState(settings?.smtp_user ?? "");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [fromEmail, setFromEmail] = useState(settings?.from_email ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await saveEmailSettings({
        smtpHost,
        smtpPort: smtpPort ?? null,
        smtpUser,
        smtpPassword,
        fromEmail,
      });
      if (result.ok) {
        toast.success("Email settings saved");
        setSmtpPassword("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="smtp-host">SMTP host</Label>
          <Input
            id="smtp-host"
            value={smtpHost}
            onChange={(e) => setSmtpHost(e.target.value)}
            placeholder="smtp.example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp-port">SMTP port</Label>
          <Input
            id="smtp-port"
            type="number"
            min={1}
            max={65535}
            value={smtpPort ?? ""}
            onChange={(e) => setSmtpPort(e.target.value ? Number(e.target.value) : null)}
            placeholder="587"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp-user">SMTP username</Label>
          <Input id="smtp-user" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp-password">SMTP password</Label>
          <Input
            id="smtp-password"
            type="password"
            value={smtpPassword}
            onChange={(e) => setSmtpPassword(e.target.value)}
            placeholder={settings?.smtp_password ? "Leave blank to keep" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="from-email">From address</Label>
          <Input
            id="from-email"
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="noreply@example.com"
          />
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
