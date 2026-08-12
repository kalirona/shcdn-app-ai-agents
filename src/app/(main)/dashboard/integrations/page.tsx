"use client";

import { useEffect, useState } from "react";

import { Calendar, Check, Globe, Mail, MessageSquare, Puzzle, Workflow, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";

import { WebhooksSection } from "./_components/webhooks-section";

interface SoonIntegration {
  name: string;
  description: string;
  icon: typeof Globe;
}

const SOON_INTEGRATIONS: SoonIntegration[] = [
  {
    name: "Google Calendar",
    description: "Sync bookings once the booking scheduler ships.",
    icon: Calendar,
  },
  {
    name: "Email notifications",
    description: "Get notified when an agent needs human takeover.",
    icon: Mail,
  },
  {
    name: "Slack",
    description: "Send lead and conversation updates to your team.",
    icon: MessageSquare,
  },
  {
    name: "Zapier",
    description: "Connect Agent AI to thousands of other apps.",
    icon: Zap,
  },
  {
    name: "Make",
    description: "Automate multi-step workflows with Agent AI triggers.",
    icon: Workflow,
  },
  {
    name: "HubSpot",
    description: "Sync leads and customers to your CRM.",
    icon: MessageSquare,
  },
];

export default function IntegrationsPage() {
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
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">Connect your AI agents to the tools your business already uses.</p>
      </div>

      {/* Connected */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Connected</h2>
        </div>

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

        {workspaceId && <WebhooksSection workspaceId={workspaceId} />}
      </section>

      {/* Available */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Available</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SOON_INTEGRATIONS.map((integration) => {
            const Icon = integration.icon;
            return (
              <div
                key={integration.name}
                className="flex flex-col justify-between gap-3 rounded-lg border border-dashed p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{integration.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        Soon
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">{integration.description}</p>
                  </div>
                </div>
                <div>
                  <Button variant="outline" size="sm" disabled className="pointer-events-none">
                    Connect
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
        <Puzzle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          More integrations are on the way — Slack, Zapier, Make, HubSpot, Google Sheets, WhatsApp and others. This page
          will become Agent AI&apos;s integration hub.
        </p>
      </div>
    </div>
  );
}
