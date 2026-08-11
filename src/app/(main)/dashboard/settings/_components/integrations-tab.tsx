"use client";

import { Check, ExternalLink, Lock, Plug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  connected: boolean;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Process payments and manage subscriptions for your customers.",
    category: "Payments",
    connected: false,
  },
  {
    id: "intercom",
    name: "Intercom",
    description: "Sync conversations and support chat with your helpdesk.",
    category: "Support",
    connected: false,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Get notified in Slack when an agent needs human takeover.",
    category: "Notifications",
    connected: false,
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Automate workflows and connect your agents to 6,000+ apps.",
    category: "Automation",
    connected: false,
  },
  {
    id: "custom",
    name: "Custom API",
    description: "Embed and interact with your agents via the REST API.",
    category: "Developer",
    connected: true,
  },
];

export function IntegrationsTab() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">Integrations</h3>
        <p className="text-muted-foreground text-sm">Connect your AI agents to the tools your business already uses.</p>
      </div>

      <div className="space-y-3">
        {INTEGRATIONS.map((integration) => (
          <div
            key={integration.id}
            className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Plug className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{integration.name}</p>
                  <Badge variant="secondary" className="text-xs">
                    {integration.category}
                  </Badge>
                  {integration.connected && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <Check />
                      Connected
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">{integration.description}</p>
              </div>
            </div>
            <Button variant={integration.connected ? "outline" : "default"} size="sm">
              {integration.connected ? "Manage" : "Connect"}
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
        <div className="flex items-center gap-3">
          <Lock className="size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">New integrations are on the way</p>
            <p className="text-muted-foreground text-xs">Want us to add a specific tool? Let us know.</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" type="button">
          Request integration <ExternalLink />
        </Button>
      </div>
    </div>
  );
}
