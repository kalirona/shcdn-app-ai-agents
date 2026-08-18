"use client";

import { useEffect, useState } from "react";

import { Loader2, Mail, RefreshCcw, Shield, User, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";
import {
  getWorkspaceMembers,
  inviteMember,
  removeMember,
  resendInvitation,
  updateMemberRole,
} from "@/lib/auth/actions/workspace.actions";
import { hasPermission, PERMISSIONS, ROLES, type Role } from "@/lib/auth/roles";
import { ROLE_LABELS } from "@/lib/auth/types";

interface MemberRow {
  id: string;
  user: string;
  name: string | null;
  email: string | null;
  role: Role;
  status: "active" | "invited" | "inactive";
  joinedAt: string;
  isSelf: boolean;
}

type AssignableRole = "admin" | "member";

function getAssignableRoles(role: Role): AssignableRole[] {
  if (role === ROLES.OWNER) return [ROLES.ADMIN, ROLES.MEMBER];
  if (role === ROLES.ADMIN) return [ROLES.MEMBER];
  return [];
}

const STATUS_CLASSES: Record<MemberRow["status"], string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  invited: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  inactive: "bg-muted text-muted-foreground",
};

export function RoleManagement() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AssignableRole>(ROLES.MEMBER);
  const [isSaving, setIsSaving] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<Role>(ROLES.MEMBER);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await getCurrentUser();
        if (cancelled) return;
        const ws = result.currentWorkspace;
        if (!ws) {
          setIsLoading(false);
          return;
        }
        setWorkspaceId(ws.id);

        const membersResult = await getWorkspaceMembers(ws.id);
        if (membersResult.success) {
          const selfId = result.user.id;
          const selfMembership = membersResult.members.find((m) => m.user === selfId);
          if (selfMembership) {
            setCurrentUserRole(selfMembership.role);
          }
          setMembers(
            membersResult.members.map((m) => ({
              id: m.id,
              user: m.user,
              name: m.name ?? null,
              email: m.email ?? null,
              role: m.role,
              status: m.status,
              joinedAt: m.date_created,
              isSelf: m.user === selfId,
            })),
          );
        } else if (membersResult.error) {
          toast.error(membersResult.error);
        }
      } catch {
        // ignore
      }
      if (!cancelled) setIsLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !workspaceId) return;
    setIsSaving(true);

    const result = await inviteMember(workspaceId, {
      email: inviteEmail.trim(),
      role: inviteRole,
    });

    setIsSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    setMembers((prev) => [
      ...prev,
      {
        id: `pending-${Date.now()}`,
        user: inviteEmail.trim(),
        name: null,
        email: inviteEmail.trim(),
        role: inviteRole,
        status: "invited",
        joinedAt: new Date().toISOString(),
        isSelf: false,
      },
    ]);
    setInviteEmail("");
    setInviteRole(ROLES.MEMBER);
    setInviteOpen(false);
    toast.success(`Invitation sent to ${inviteEmail.trim()}`);
  }

  async function handleRoleChange(memberId: string, newRole: AssignableRole) {
    if (!workspaceId) return;
    if (!hasPermission(currentUserRole, PERMISSIONS.MEMBERS_CHANGE_ROLE)) {
      toast.error("You don't have permission to change roles.");
      return;
    }
    const result = await updateMemberRole(workspaceId, { membershipId: memberId, role: newRole });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
    toast.success("Role updated successfully");
  }

  async function handleRemoveMember(memberId: string) {
    if (!workspaceId) return;
    const result = await removeMember(workspaceId, { membershipId: memberId });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast.success("Member removed from workspace");
  }

  async function handleResendInvitation(memberId: string) {
    if (!workspaceId) return;
    const result = await resendInvitation(workspaceId, { membershipId: memberId });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Invitation resent");
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canInvite = hasPermission(currentUserRole, PERMISSIONS.MEMBERS_INVITE);
  const canChangeRole = hasPermission(currentUserRole, PERMISSIONS.MEMBERS_CHANGE_ROLE);
  const canRemove = hasPermission(currentUserRole, PERMISSIONS.MEMBERS_REMOVE);
  const assignableRoles = getAssignableRoles(currentUserRole);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Members &amp; Roles</h3>
          <p className="text-muted-foreground text-sm">Manage who can access this workspace.</p>
        </div>
        {canInvite && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite team member</DialogTitle>
                <DialogDescription>Invite a new member to collaborate on this workspace.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AssignableRole)}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          <div>
                            <p>{ROLE_LABELS[role]}</p>
                            <p className="text-muted-foreground text-xs">
                              {role === ROLES.ADMIN
                                ? "Manage agents, knowledge, conversations, leads, and bookings"
                                : "View conversations, take over chats, and see customer information"}
                            </p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setInviteOpen(false)} disabled={isSaving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving || !inviteEmail.trim()}>
                    {isSaving && <Loader2 className="size-4 animate-spin" />}
                    Send Invitation
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Mail className="size-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No team members yet</p>
          <p className="text-muted-foreground text-sm">Invite members to collaborate on this workspace.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-sm">Name</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Email</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Role</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const displayName = member.name ?? (member.email ? member.email.split("@")[0] : "Invited");
                return (
                  <tr key={member.id} className="border-b">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {displayName}
                            {member.isSelf && <span className="ml-2 text-muted-foreground text-xs">(you)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-muted-foreground text-sm">{member.email ?? "Awaiting activation"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {canChangeRole && !member.isSelf && member.role !== ROLES.OWNER ? (
                        <Select
                          value={member.role}
                          onValueChange={(v) => handleRoleChange(member.id, v as AssignableRole)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getAssignableRoles(currentUserRole).map((role) => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
                          {member.role === ROLES.OWNER ? (
                            <Shield className="size-3 text-primary" />
                          ) : (
                            <User className="size-3" />
                          )}
                          {ROLE_LABELS[member.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_CLASSES[member.status]}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canInvite && member.status === "invited" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResendInvitation(member.id)}
                            title="Resend invitation"
                          >
                            <RefreshCcw className="size-4" />
                            Resend
                          </Button>
                        )}
                        {canRemove && !member.isSelf && member.role !== ROLES.OWNER && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveMember(member.id)}
                            title="Remove member"
                          >
                            <UserMinus className="size-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
