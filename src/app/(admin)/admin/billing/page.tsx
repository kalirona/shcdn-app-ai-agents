import type { ComponentType, ReactNode } from "react";

import { AlertCircle, CheckCircle, CreditCard, DollarSign, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAccess } from "@/lib/auth/platform-access";
import { getAllWorkspaces } from "@/lib/db/repositories/workspace.repo";

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="font-bold text-2xl">{value}</div>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </CardContent>
    </Card>
  );
}

function DataTable({
  headers,
  rows,
  emptyMessage = "No data available",
}: {
  headers: string[];
  rows: { cells: ReactNode[] }[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">{emptyMessage}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-sm">
                {headers.map((h) => (
                  <th key={h} className="pb-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                  {row.cells.map((cell, j) => (
                    <td key={j} className="py-3 text-sm">
                      {typeof cell === "string" ? cell : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminBillingPage() {
  // Verify Super Admin access
  await requirePlatformAccess("platform:billing:read");

  const workspaces = await getAllWorkspaces();

  // Calculate metrics
  const totalSubscriptions = workspaces.length;
  const byPlan = workspaces.reduce(
    (acc, w) => {
      acc[w.plan] = (acc[w.plan] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const byStatus = workspaces.reduce(
    (acc, w) => {
      acc[w.subscription_status] = (acc[w.subscription_status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const activeCount = byStatus.active || 0;
  const trialingCount = byStatus.trialing || 0;
  const canceledCount = byStatus.canceled || 0;
  const pastDueCount = byStatus.past_due || 0;
  const freeCount = byStatus.free || 0;

  // Monthly revenue - not available from current data
  const monthlyRevenue = "Revenue data unavailable";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Platform Billing</h1>
        <p className="text-muted-foreground">Platform-wide subscription overview</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Total Subscriptions"
          value={totalSubscriptions}
          description="All workspace subscriptions"
          icon={CreditCard}
        />
        <MetricCard
          title="Active"
          value={activeCount}
          description={`${trialingCount} trialing, ${pastDueCount} past due`}
          icon={CheckCircle}
        />
        <MetricCard title="Canceled" value={canceledCount} description="Ended subscriptions" icon={AlertCircle} />
        <MetricCard
          title="Monthly Revenue"
          value={monthlyRevenue}
          description="Requires payment provider integration"
          icon={DollarSign}
        />
        <MetricCard title="Free Tier" value={freeCount} description="Workspaces on free plan" icon={Users} />
      </div>

      {/* Plan Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions by Plan</CardTitle>
            <CardDescription>Distribution of plans across workspaces</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              headers={["Plan", "Workspaces", "Percentage"]}
              rows={["starter", "business", "pro", "free"].map((plan) => {
                const count = byPlan[plan] || 0;
                const pct = totalSubscriptions > 0 ? ((count / totalSubscriptions) * 100).toFixed(1) : "0";
                return {
                  cells: [plan.charAt(0).toUpperCase() + plan.slice(1), count.toString(), `${pct}%`],
                };
              })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription Status</CardTitle>
            <CardDescription>Current subscription lifecycle status</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              headers={["Status", "Workspaces", "Percentage"]}
              rows={[
                [
                  "Active",
                  activeCount,
                  totalSubscriptions > 0 ? ((activeCount / totalSubscriptions) * 100).toFixed(1) : "0",
                ],
                [
                  "Trialing",
                  trialingCount,
                  totalSubscriptions > 0 ? ((trialingCount / totalSubscriptions) * 100).toFixed(1) : "0",
                ],
                [
                  "Canceled",
                  canceledCount,
                  totalSubscriptions > 0 ? ((canceledCount / totalSubscriptions) * 100).toFixed(1) : "0",
                ],
                [
                  "Past Due",
                  pastDueCount,
                  totalSubscriptions > 0 ? ((pastDueCount / totalSubscriptions) * 100).toFixed(1) : "0",
                ],
                ["Free", freeCount, totalSubscriptions > 0 ? ((freeCount / totalSubscriptions) * 100).toFixed(1) : "0"],
              ].map(([status, count, pct]) => ({
                cells: [status, count.toString(), `${pct}%`],
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* All Workspaces Billing Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Workspace Subscriptions</CardTitle>
          <CardDescription>Read-only view of all workspace billing status</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["Workspace", "Plan", "Status", "Payment Provider", "Current Period End", "Cancel at Period End"]}
            rows={workspaces.map((w) => ({
              cells: [
                <span key="name" className="font-medium">
                  {w.name}
                </span>,
                <Badge key="plan" variant="outline">
                  {w.plan}
                </Badge>,
                <Badge
                  key="status"
                  variant={
                    w.subscription_status === "active"
                      ? "default"
                      : w.subscription_status === "trialing"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {w.subscription_status}
                </Badge>,
                w.payment_provider ?? "—",
                w.current_period_end ? new Date(w.current_period_end).toLocaleDateString() : "—",
                w.cancel_at_period_end ? (
                  <Badge key="cancel" variant="secondary">
                    Yes
                  </Badge>
                ) : (
                  <Badge key="cancel" variant="outline">
                    No
                  </Badge>
                ),
              ],
            }))}
            emptyMessage="No workspaces found"
          />
        </CardContent>
      </Card>
    </div>
  );
}
