"use client";

import type * as React from "react";

import { AlertTriangle, Calendar, ChevronLeft, Clock, Globe, Key, Mail, Shield, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { UserActions } from "./user-actions";

interface UserDetailDialogProps {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    status: string;
    platformBanned: boolean;
    banReason: string | null;
    bannedAt: string | null;
    forcePasswordReset: boolean;
    lastAccess: string | null;
    lastPage: string | null;
    provider: string;
    dateCreated: string | null;
    platformRole: string | null;
    memberships: Array<{
      id: string;
      workspaceId: string;
      workspaceName: string;
      role: string;
      status: string;
      joinedAt: string;
    }>;
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

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

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm text-foreground break-all">{value}</span>
    </div>
  );
}

export function UserDetailDialog({ user }: UserDetailDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <span className="sr-only">View details</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {user.email}
          </DialogTitle>
        </DialogHeader>
        <Separator />
        <ScrollArea className="flex-1 p-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoRow
              label="Name"
              value={[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
              icon={Users}
            />
            <InfoRow
              label="Status"
              value={<StatusBadge status={user.status} platformBanned={user.platformBanned} />}
              icon={Shield}
            />
            <InfoRow label="Platform role" value={user.platformRole || "—"} icon={Shield} />
            <InfoRow label="Force password reset" value={user.forcePasswordReset ? "Yes" : "No"} icon={Key} />
            <InfoRow label="Provider" value={user.provider} icon={Globe} />
            <InfoRow label="Created" value={formatDate(user.dateCreated)} icon={Calendar} />
            <InfoRow label="Last access" value={formatDate(user.lastAccess)} icon={Clock} />
            <InfoRow label="Last page" value={user.lastPage || "—"} icon={Globe} />
          </div>

          {user.platformBanned && user.banReason && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Ban reason</span>
              </div>
              <p className="mt-2 text-sm">{user.banReason}</p>
              <p className="mt-1 text-xs text-muted-foreground">Banned at: {formatDate(user.bannedAt)}</p>
            </div>
          )}

          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Workspace Memberships ({user.memberships.length})</h4>
              <Badge variant="outline">{user.memberships.length}</Badge>
            </div>
            {user.memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workspace memberships</p>
            ) : (
              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3 font-medium">Workspace</th>
                      <th className="p-3 font-medium">Role</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.memberships.map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="p-3">{m.workspaceName}</td>
                        <td className="p-3 capitalize">{m.role}</td>
                        <td className="p-3">
                          <Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{formatDate(m.joinedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Separator />
          <UserActions user={user} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
