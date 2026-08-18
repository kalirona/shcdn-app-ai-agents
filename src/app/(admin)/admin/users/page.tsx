import { Suspense } from "react";

import { ChevronRight, Search, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminUsers } from "@/lib/auth/actions/admin/users.actions";
import { requirePlatformAccess } from "@/lib/auth/platform-access";

import { UserActions } from "./_components/user-actions";
import { UserDetailDialog } from "./_components/user-detail-dialog";
import { UsersFilters } from "./_components/users-filters";

const PAGE_SIZE = 25;

function StatusBadge({ status, platformBanned }: { status: string; platformBanned: boolean }) {
  if (platformBanned) {
    return <Badge variant="destructive">Banned</Badge>;
  }
  switch (status) {
    case "active":
      return <Badge variant="default">Active</Badge>;
    case "invited":
      return <Badge variant="secondary">Invited</Badge>;
    case "suspended":
      return <Badge variant="outline">Suspended</Badge>;
    case "archived":
      return <Badge variant="secondary">Archived</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function mapUserForDetail(u: {
  id: string;
  email: string;
  name: string | null;
  status: string;
  platformBanned: boolean;
  lastAccess: string | null;
  platformRole: string | null;
  membershipCount: number;
  forcePasswordReset: boolean;
}) {
  const nameParts = (u.name ?? "").split(" ");
  return {
    id: u.id,
    email: u.email,
    firstName: nameParts[0] ?? null,
    lastName: nameParts.slice(1).join(" ") || null,
    status: u.status,
    platformBanned: u.platformBanned,
    banReason: null,
    bannedAt: null,
    forcePasswordReset: u.forcePasswordReset,
    lastAccess: u.lastAccess,
    lastPage: null,
    provider: "directus",
    dateCreated: null,
    platformRole: u.platformRole,
    memberships: [],
  };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePlatformAccess("platform:users:read");

  const sp = await searchParams;
  const read = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const q = read("q") ?? "";
  const status = read("status") ?? "";
  const page = Math.max(1, Number(read("page") ?? "1") || 1);

  const result = await getAdminUsers(q || undefined, status || undefined, page, PAGE_SIZE);

  const totalPages = result.ok ? Math.max(1, Math.ceil(result.data.total / PAGE_SIZE)) : 1;
  const hasFilters = Boolean(q || status);

  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    params.set("page", String(nextPage));
    return `/admin/users?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Platform Users</h1>
        <p className="text-muted-foreground">
          All users across the platform ({result.ok ? result.data.total : 0} total)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter users</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading filters...</div>}>
            <UsersFilters />
          </Suspense>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Users</h2>
          {hasFilters && (
            <a href="/admin/users" className="text-muted-foreground text-sm hover:underline">
              Clear filters
            </a>
          )}
        </div>

        {result.ok ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Workspaces</TableHead>
                  <TableHead>Platform Role</TableHead>
                  <TableHead>Last Access</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                      <p>No users found</p>
                      <p className="mt-1 text-sm">Try adjusting your filters</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  result.data.users.map((u) => {
                    const detailUser = mapUserForDetail(u);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="w-8">
                          <UserDetailDialog user={detailUser} />
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{u.name ?? "—"}</span>
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <StatusBadge status={u.status} platformBanned={u.platformBanned} />
                        </TableCell>
                        <TableCell>{u.membershipCount}</TableCell>
                        <TableCell>
                          <Badge variant={u.platformRole === "super_admin" ? "default" : "outline"}>
                            {u.platformRole ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(u.lastAccess)}</TableCell>
                        <TableCell>
                          <UserActions user={u} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href={buildHref(page - 1)}
                      aria-disabled={page <= 1}
                      className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-4 text-muted-foreground text-sm">
                      Page {page} of {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href={buildHref(page + 1)}
                      aria-disabled={page >= totalPages}
                      className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-destructive">
              <Search className="mx-auto mb-4 h-12 w-12 text-destructive/30" />
              <p className="font-medium">Failed to load users</p>
              <p className="mt-1 text-sm">{result.error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
