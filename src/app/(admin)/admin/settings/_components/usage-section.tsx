"use client";

import { useEffect, useState } from "react";

import { getAdminUsageSnapshot } from "@/lib/auth/actions/admin/settings.actions";

interface Snapshot {
  stats: {
    totalUsers: number;
    totalWorkspaces: number;
    totalAgents: number;
    totalConversations: number;
    totalRevenue: number;
    activeSubscriptions: number;
  };
  models: {
    total: number;
    enabled: number;
    byProvider: Record<string, number>;
  } | null;
}

export function UsageSection() {
  const [data, setData] = useState<Snapshot["stats"] | null>(null);
  const [modelCounts, setModelCounts] = useState<Snapshot["models"] | null>(null);

  useEffect(() => {
    void getAdminUsageSnapshot().then((snapshot) => {
      setData(snapshot.stats);
      setModelCounts(snapshot.models);
    });
  }, []);

  const items = [
    { label: "Total users", value: data?.totalUsers ?? "—" },
    { label: "Workspaces", value: data?.totalWorkspaces ?? "—" },
    { label: "Agents", value: data?.totalAgents ?? "—" },
    { label: "Conversations", value: data?.totalConversations ?? "—" },
    { label: "Active subscriptions", value: data?.activeSubscriptions ?? "—" },
    { label: "Estimated MRR", value: data ? `$${data.totalRevenue}` : "—" },
    { label: "Registry models", value: modelCounts ? `${modelCounts.enabled}/${modelCounts.total}` : "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border bg-background p-4">
            <p className="text-muted-foreground text-sm">{item.label}</p>
            <p className="mt-1 font-semibold text-xl">{item.value}</p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Plan limits are enforced per workspace. Configure hard caps on provider spend in a future release.
      </p>
    </div>
  );
}
