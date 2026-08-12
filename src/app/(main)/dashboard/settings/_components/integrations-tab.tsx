"use client";

import { useEffect, useState } from "react";

import { Check, Globe, Mail, MessageSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";

import { WebhooksSection } from "./webhooks-section";

export function IntegrationsTab() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await getCurrentUser();
        if (cancelled) return;
        setWorkspaceId(result.currentWorkspace?.id ?? null);
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">Integrations</h3>
        <p className="text-muted-foreground text-sm">Connect your AI agents to the tools your business already uses.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Globe className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">Website Widget</p>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <Check />
                  Connected
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Embed your AI agent on any website with a single script tag.
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            Automatic
          </Badge>
        </div>
      </div>

      {workspaceId && <WebhooksSection workspaceId={workspaceId} />}

      <div className="space-y-3">
        <div className="rounded-lg border border-dashed p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <p className="font-medium text-sm">Email notifications</p>
              <p className="text-muted-foreground text-xs">Get notified when an agent needs human takeover.</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-dashed p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Mail className="size-5" />
            </div>
            <div>
              <p className="font-medium text-sm">Google Calendar</p>
              <p className="text-muted-foreground text-xs">Sync bookings once the booking scheduler ships.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
