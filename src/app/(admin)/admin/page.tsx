import type { ComponentType, ReactNode } from "react";

import { Activity, ArrowDownRight, ArrowUpRight, Building, DollarSign, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAccess } from "@/lib/auth/platform-access";
import { getAllMemberships } from "@/lib/db/repositories/membership.repo";
import { getAllPlatformRoles } from "@/lib/db/repositories/platform-role.repo";
import { getAllWorkspaces } from "@/lib/db/repositories/workspace.repo";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  trend?: { value: number; label: string; positive: boolean };
}

function MetricCard({ title, value, description, icon: Icon, trend }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="font-bold text-2xl">{value}</div>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
        {trend && (
          <div className="mt-2 flex items-center gap-1">
            {trend.positive ? (
              <ArrowUpRight className="h-3 w-3 text-green-600" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-red-600" />
            )}
            <span className="font-medium text-xs">{trend.value}%</span>
            <span className="text-muted-foreground text-xs">{trend.label}</span>
          </div>
        )}
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

export default async function AdminOverviewPage() {
  // Verify Super Admin access
  await requirePlatformAccess("platform:users:read");

  const [workspaces, memberships, platformRoles] = await Promise.all([
    getAllWorkspaces(),
    getAllMemberships(),
    getAllPlatformRoles(),
  ]);

  // Calculate metrics
  const totalWorkspaces = workspaces.length;
  const totalUsers = new Set(memberships.map((m) => m.user)).size;
  const superAdmins = platformRoles.filter((r) => r.status === "active").length;

  const subscriptionsByPlan = workspaces.reduce(
    (acc, w) => {
      acc[w.plan] = (acc[w.plan] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const subscriptionsByStatus = workspaces.reduce(
    (acc, w) => {
      acc[w.subscription_status] = (acc[w.subscription_status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const activeSubscriptions = subscriptionsByStatus.active || 0;
  const trialingSubscriptions = subscriptionsByStatus.trialing || 0;
  const canceledSubscriptions = subscriptionsByStatus.canceled || 0;

  // Monthly revenue - not available from current data
  const monthlyRevenue = "Data unavailable";

  // Recent workspaces (last 5)
  const recentWorkspaces = workspaces.slice(0, 5);

  // Recent users (last 5 unique users from memberships)
  const userWorkspaceCount = memberships.reduce(
    (acc, m) => {
      acc[m.user] = (acc[m.user] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const recentUsers = Object.entries(userWorkspaceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([userId, count]) => ({
      userId,
      workspaceCount: count,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Platform Admin Overview</h1>
          <p className="text-muted-foreground">Platform-wide metrics and recent activity</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Total Users"
          value={totalUsers}
          description="Unique users across all workspaces"
          icon={Users}
        />
        <MetricCard
          title="Total Workspaces"
          value={totalWorkspaces}
          description="Active and inactive workspaces"
          icon={Building}
        />
        <MetricCard
          title="Active Subscriptions"
          value={activeSubscriptions}
          description={`${trialingSubscriptions} trialing, ${canceledSubscriptions} canceled`}
          icon={DollarSign}
        />
        <MetricCard
          title="Monthly Revenue"
          value={monthlyRevenue}
          description="Requires payment provider integration"
          icon={Activity}
        />
        <MetricCard title="Super Admins" value={superAdmins} description="Platform administrators" icon={Users} />
      </div>

      {/* Plan Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions by Plan</CardTitle>
            <CardDescription>Current plan distribution across workspaces</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              headers={["Plan", "Workspaces", "Percentage"]}
              rows={["starter", "business", "pro", "free"].map((plan) => {
                const count = subscriptionsByPlan[plan] || 0;
                const pct = totalWorkspaces > 0 ? ((count / totalWorkspaces) * 100).toFixed(1) : "0";
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
                  activeSubscriptions,
                  totalWorkspaces > 0 ? ((activeSubscriptions / totalWorkspaces) * 100).toFixed(1) : "0",
                ],
                [
                  "Trialing",
                  trialingSubscriptions,
                  totalWorkspaces > 0 ? ((trialingSubscriptions / totalWorkspaces) * 100).toFixed(1) : "0",
                ],
                [
                  "Canceled",
                  canceledSubscriptions,
                  totalWorkspaces > 0 ? ((canceledSubscriptions / totalWorkspaces) * 100).toFixed(1) : "0",
                ],
                [
                  "Past Due",
                  subscriptionsByStatus.past_due || 0,
                  totalWorkspaces > 0
                    ? (((subscriptionsByStatus.past_due || 0) / totalWorkspaces) * 100).toFixed(1)
                    : "0",
                ],
              ].map(([status, count, pct]) => ({
                cells: [status, count.toString(), `${pct}%`],
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Workspaces</CardTitle>
            <CardDescription>Latest 5 workspaces created</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              headers={["Workspace", "Owner", "Plan", "Status", "Created"]}
              rows={recentWorkspaces.map((w) => ({
                cells: [
                  <span key="name" className="font-medium">
                    {w.name}
                  </span>,
                  w.slug, // owner info would need a join
                  <Badge key="plan" variant="outline">
                    {w.plan}
                  </Badge>,
                  <Badge key="status" variant={w.subscription_status === "active" ? "default" : "secondary"}>
                    {w.subscription_status}
                  </Badge>,
                  new Date(w.date_created).toLocaleDateString(),
                ],
              }))}
              emptyMessage="No workspaces found"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
            <CardDescription>Top 5 users by workspace count</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              headers={["User ID", "Workspaces"]}
              rows={recentUsers.map((u) => ({
                cells: [u.userId, u.workspaceCount.toString()],
              }))}
              emptyMessage="No users found"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
