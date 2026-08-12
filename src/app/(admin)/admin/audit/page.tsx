import type { ComponentType } from "react";

import { AlertCircle, FileText, Shield } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAccess } from "@/lib/auth/platform-access";

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

export default async function AdminAuditPage() {
  // Verify Super Admin access
  await requirePlatformAccess("platform:audit:read");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Platform Audit Logs</h1>
          <p className="text-muted-foreground">Platform-wide activity and security audit trail</p>
        </div>
      </div>

      {/* Metrics Grid - placeholder since no audit system exists yet */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Events" value="—" description="Audit logging not yet implemented" icon={FileText} />
        <MetricCard title="Security Events" value="—" description="Failed logins, permission changes" icon={Shield} />
        <MetricCard title="Admin Actions" value="—" description="Super Admin mutations" icon={AlertCircle} />
        <MetricCard title="Retention" value="—" description="Configurable retention policy" icon={FileText} />
      </div>

      {/* Status Notice */}
      <Card className="border-yellow-500/50 bg-yellow-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="h-5 w-5" />
            Audit Logging Not Yet Implemented
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-yellow-700">
            Platform audit logging is not currently available. This page provides the UI shell for future
            implementation.
          </p>
          <div className="space-y-2 text-sm text-yellow-700">
            <h4 className="font-medium">Planned audit events:</h4>
            <ul className="list-inside list-disc space-y-1">
              <li>Super Admin login / logout</li>
              <li>Super Admin role assignments</li>
              <li>Workspace suspension / reactivation</li>
              <li>Plan changes initiated by platform</li>
              <li>Billing modifications (cancellations, refunds)</li>
              <li>User impersonation sessions</li>
              <li>Platform settings changes</li>
              <li>Failed authorization attempts</li>
            </ul>
          </div>
          <div className="space-y-2 text-sm text-yellow-700">
            <h4 className="font-medium">Implementation requirements:</h4>
            <ul className="list-inside list-disc space-y-1">
              <li>
                Create <code>platform_audit_logs</code> collection in Directus
              </li>
              <li>
                Add audit logging middleware to <code>requirePlatformAccess</code>
              </li>
              <li>Implement structured event schema (actor, action, target, metadata)</li>
              <li>Add retention policy and archival strategy</li>
              <li>Build query/filter UI for audit log exploration</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Empty state for future log entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Audit Events</CardTitle>
          <CardDescription>Will display once audit logging is implemented</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p>No audit events to display</p>
          <p className="mt-1 text-sm">Enable audit logging to start capturing platform activity</p>
        </CardContent>
      </Card>
    </div>
  );
}
