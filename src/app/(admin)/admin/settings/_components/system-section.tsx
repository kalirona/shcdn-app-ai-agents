"use client";

import type { AIProviderSafe } from "@/lib/db/repositories/ai-provider.repo";

interface Props {
  providers: AIProviderSafe[];
  modelsTotal: number;
}

export function SystemSection({ providers, modelsTotal }: Props) {
  const providerConnections = providers.filter((p) => p.status === "ok").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-muted-foreground text-sm">Configured providers</p>
          <p className="mt-1 font-semibold text-xl">{providers.length}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-muted-foreground text-sm">Healthy connections</p>
          <p className="mt-1 font-semibold text-xl">{providerConnections}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-muted-foreground text-sm">Registered models</p>
          <p className="mt-1 font-semibold text-xl">{modelsTotal}</p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <p className="font-medium text-sm">Check connectivity</p>
        <p className="text-muted-foreground text-xs">
          Use the Test connection action on each provider in the {"AI Providers"} section. A green status badge means
          that provider responded to a real model-list request.
        </p>
      </div>
    </div>
  );
}
