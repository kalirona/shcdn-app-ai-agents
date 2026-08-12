import type { ReactNode } from "react";

import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePlatformAccess } from "@/lib/auth/platform-access";
import { getAllMemberships } from "@/lib/db/repositories/membership.repo";
import { getAllPlatformRoles } from "@/lib/db/repositories/platform-role.repo";

interface UserRow {
  userId: string;
  email: string;
  name: string | null;
  workspaceCount: number;
  workspaces: string[];
  isSuperAdmin: boolean;
  status: string;
  createdAt: string;
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

export default async function AdminUsersPage() {
  // Verify Super Admin access
  await requirePlatformAccess("platform:users:read");

  const [memberships, platformRoles] = await Promise.all([getAllMemberships(), getAllPlatformRoles()]);

  // Build user map
  const userMap = new Map<string, UserRow>();

  for (const m of memberships) {
    if (!userMap.has(m.user)) {
      userMap.set(m.user, {
        userId: m.user,
        email: m.email ?? m.user,
        name: m.name,
        workspaceCount: 0,
        workspaces: [],
        isSuperAdmin: false,
        status: m.status,
        createdAt: m.date_created,
      });
    }
    const user = userMap.get(m.user)!;
    user.workspaceCount += 1;
    user.workspaces.push(m.workspace);
    user.status = m.status;
    // Keep earliest created date
    if (new Date(m.date_created) < new Date(user.createdAt)) {
      user.createdAt = m.date_created;
    }
  }

  // Mark super admins
  const superAdminIds = new Set(platformRoles.filter((r) => r.status === "active").map((r) => r.user));
  for (const [userId, user] of userMap) {
    user.isSuperAdmin = superAdminIds.has(userId);
  }

  // Convert to array and sort by workspace count desc
  const users = Array.from(userMap.values()).sort((a, b) => b.workspaceCount - a.workspaceCount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Platform Users</h1>
          <p className="text-muted-foreground">All users across the platform ({users.length} total)</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Users</CardTitle>
          <div className="relative max-w-xs">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-9"
              onChange={(e) => {
                // Client-side filtering would be added here
                console.log("Search:", e.target.value);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["Name", "Email", "Status", "Workspaces", "Super Admin", "Created"]}
            rows={users.map((u) => ({
              cells: [
                <span key="name" className="font-medium">
                  {u.name ?? "—"}
                </span>,
                u.email,
                <Badge key="status" variant={u.status === "active" ? "default" : "secondary"}>
                  {u.status}
                </Badge>,
                u.workspaceCount,
                u.isSuperAdmin ? (
                  <Badge key="sa" variant="default">
                    Yes
                  </Badge>
                ) : (
                  <Badge key="sa" variant="secondary">
                    No
                  </Badge>
                ),
                new Date(u.createdAt).toLocaleDateString(),
              ],
            }))}
            emptyMessage="No users found"
          />
        </CardContent>
      </Card>
    </div>
  );
}
