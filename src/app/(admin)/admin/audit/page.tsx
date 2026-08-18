import type { ComponentType, ReactNode } from "react";
import { Suspense } from "react";

import { AlertCircle, FileText, Shield, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { requirePlatformAccess } from "@/lib/auth/platform-access";
import type { AuditCategory, AuditSeverity } from "@/lib/db/entities";
import { getAuditLogs, getAuditMetrics } from "@/lib/db/repositories/audit.repo";

import { AuditFilters } from "./_components/audit-filters";

const PAGE_SIZE = 25;

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

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  auth: "Auth",
  admin: "Admin",
  workspace: "Workspace",
  user: "User",
  security: "Security",
  system: "System",
};

const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  if (severity === "critical") variant = "destructive";
  if (severity === "warning") variant = "outline";
  return <Badge variant={variant}>{SEVERITY_LABELS[severity]}</Badge>;
}

function StatusBadge({ status }: { status: "success" | "failure" }) {
  return <Badge variant={status === "success" ? "default" : "destructive"}>{status}</Badge>;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function actionLabel(action: string): string {
  return action.replaceAll("_", " ");
}

function AuditTable({ rows }: { rows: { key: string; cells: ReactNode[] }[] }) {
  const COLUMN_KEYS = ["timestamp", "action", "category", "actor", "target", "severity", "status"];
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p>No audit events found</p>
          <p className="mt-1 text-sm">Try adjusting your filters, or perform a sign-in to generate events.</p>
        </CardContent>
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
                <th className="pb-3 font-medium">Timestamp</th>
                <th className="pb-3 font-medium">Action</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 font-medium">Actor</th>
                <th className="pb-3 font-medium">Target</th>
                <th className="pb-3 font-medium">Severity</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b last:border-0 hover:bg-muted/50">
                  {row.cells.map((cell, j) => (
                    <td key={`${row.key}-${COLUMN_KEYS[j]}`} className="py-3 pr-4 text-sm">
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

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePlatformAccess("platform:audit:read");

  const sp = await searchParams;
  const read = (k: string) => {
    const v = typeof sp[k] === "string" ? (sp[k] as string) : undefined;
    return v?.trim() ? v : undefined;
  };
  const q = read("q") ?? "";
  const category = read("category") as AuditCategory | undefined;
  const severity = read("severity") as AuditSeverity | undefined;
  const status = read("status") as "success" | "failure" | undefined;
  const page = Math.max(1, Number(read("page") ?? "1") || 1);

  const [result, metrics] = await Promise.all([
    getAuditLogs({
      q: q || undefined,
      category: category ?? null,
      severity: severity ?? null,
      status: status ?? null,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    getAuditMetrics(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const hasFilters = Boolean(q) || Boolean(category) || Boolean(severity) || Boolean(status);
  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (severity) params.set("severity", severity);
    if (status) params.set("status", status);
    params.set("page", String(nextPage));
    return `/admin/audit?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Platform Audit Logs</h1>
        <p className="text-muted-foreground">Platform-wide activity and security audit trail ({result.total} events)</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Events" value={metrics.total} description="All recorded events" icon={FileText} />
        <MetricCard
          title="Security Events"
          value={metrics.security}
          description="Denied access, failures"
          icon={Shield}
        />
        <MetricCard title="Admin Actions" value={metrics.admin} description="Super Admin mutations" icon={Users} />
        <MetricCard
          title="Auth Events"
          value={metrics.auth}
          description="Logins, signups, logouts"
          icon={AlertCircle}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and narrow the audit trail</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-muted-foreground text-sm">Loading filters...</div>}>
            <AuditFilters />
          </Suspense>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Recent Audit Events</h2>
          {hasFilters && (
            <a href="/admin/audit" className="text-muted-foreground text-sm hover:underline">
              Clear filters
            </a>
          )}
        </div>

        <AuditTable
          rows={result.events.map((e) => ({
            key: e.id,
            cells: [
              <span key="ts" className="whitespace-nowrap text-muted-foreground">
                {formatDate(e.date_created)}
              </span>,
              <span key="action" className="font-medium">
                {actionLabel(e.action)}
              </span>,
              <Badge key="cat" variant="outline">
                {CATEGORY_LABELS[e.category] ?? e.category}
              </Badge>,
              <span key="actor">{e.actor_email ?? "System"}</span>,
              <span key="target" className="text-muted-foreground">
                {e.target_label ?? "—"}
              </span>,
              <SeverityBadge key="sev" severity={e.severity} />,
              <StatusBadge key="st" status={e.status} />,
            ],
          }))}
        />

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
      </div>
    </div>
  );
}
