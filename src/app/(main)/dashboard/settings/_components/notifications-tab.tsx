"use client";

import { useState } from "react";

import { Bell } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
}

const SETTINGS: NotificationSetting[] = [
  {
    id: "agent-takeover",
    title: "Agent takeover alerts",
    description: "Get notified when a customer asks to speak with a human.",
    enabled: true,
  },
  {
    id: "daily-digest",
    title: "Daily digest",
    description: "A summary of conversations and leads each morning.",
    enabled: true,
  },
  {
    id: "weekly-report",
    title: "Weekly performance report",
    description: "Metrics on agent performance, handoffs, and satisfaction.",
    enabled: true,
  },
  {
    id: "new-member",
    title: "New team members",
    description: "When someone joins or is invited to your workspace.",
    enabled: true,
  },
  {
    id: "billing",
    title: "Billing notifications",
    description: "Payment failures, invoice availability, and plan changes.",
    enabled: false,
  },
];

export function NotificationsTab() {
  const [settings, setSettings] = useState<NotificationSetting[]>(SETTINGS);

  function toggle(id: string) {
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
    toast.success("Notification preference updated");
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">Notifications</h3>
        <p className="text-muted-foreground text-sm">Choose which updates you want to receive.</p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        {settings.map((setting, index) => (
          <div
            key={setting.id}
            className={`flex items-center justify-between gap-4 bg-background p-4 ${index > 0 ? "border-t" : ""}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Bell className="size-4" />
              </div>
              <div>
                <p className="font-medium">{setting.title}</p>
                <p className="text-muted-foreground text-sm">{setting.description}</p>
              </div>
            </div>
            <Label htmlFor={`notif-${setting.id}`} className="sr-only">
              {setting.title}
            </Label>
            <Switch id={`notif-${setting.id}`} checked={setting.enabled} onCheckedChange={() => toggle(setting.id)} />
          </div>
        ))}
      </div>

      <Button variant="outline" onClick={() => toast.success("All preferences reset")}>
        Reset to defaults
      </Button>
    </div>
  );
}
