import type { ReactNode } from "react";

import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePlatformAccess } from "@/lib/auth/platform-access";
import { getAllMemberships } from "@/lib/db/repositories/membership.repo";
import { getAllWorkspaces } from "@/lib/db/repositories/workspace.repo";

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

export default async function AdminWorkspacesPage() {
  // Verify Super Admin access
  await requirePlatformAccess("platform:workspaces:read");

  const [workspaces, memberships] = await Promise.all([getAllWorkspaces(), getAllMemberships()]);

  // Build workspace member map
  const workspaceMembers = new Map<string, { count: number; owners: string[]; admins: string[] }>();
  for (const m of memberships) {
    if (!workspaceMembers.has(m.workspace)) {
      workspaceMembers.set(m.workspace, { count: 0, owners: [], admins: [] });
    }
    const wm = workspaceMembers.get(m.workspace)!;
    wm.count += 1;
    if (m.role === "owner") wm.owners.push(m.user);
    if (m.role === "admin") wm.admins.push(m.user);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Platform Workspaces</h1>
        <p className="text-muted-foreground">All workspaces across the platform ({workspaces.length} total)</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Workspaces</CardTitle>
          <div className="relative max-w-xs">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search workspaces..." className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["Workspace", "Owner", "Plan", "Subscription Status", "Members", "Created"]}
            rows={workspaces.map((w) => {
              const members = workspaceMembers.get(w.id);
              const owner = members?.owners[0] ?? "—";
              return {
                cells: [
                  <span key="name" className="font-medium">
                    {w.name}
                  </span>,
                  owner,
                  <Badge key="plan" variant="outline">
                    {w.plan}
                  </Badge>,
                  <Badge key="status" variant={w.subscription_status === "active" ? "default" : "secondary"}>
                    {w.subscription_status}
                  </Badge>,
                  members?.count ?? 0,
                  new Date(w.date_created).toLocaleDateString(),
                ],
              };
            })}
            emptyMessage="No workspaces found"
          />
        </CardContent>
      </Card>
    </div>
  );
}
