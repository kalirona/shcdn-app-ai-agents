"use client";

import { useEffect, useState } from "react";
import { Loader2, Shield, UserMinus, UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  hasPermission,
  PERMISSIONS,
  ROLES,
  type Role,
} from "@/lib/auth/roles";

interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
  avatar?: string;
}

const STORAGE_KEY = "agent_ai_members";

function getMembers(): Member[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  const defaults: Member[] = [
    {
      id: "dev-user-123",
      name: "Dev User",
      email: "dev@localhost.com",
      role: ROLES.OWNER,
      joinedAt: new Date().toISOString(),
    },
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

function saveMembers(members: Member[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

function getAssignableRoles(role: Role): Role[] {
  if (role === ROLES.OWNER) return [ROLES.ADMIN, ROLES.MEMBER];
  if (role === ROLES.ADMIN) return [ROLES.MEMBER];
  return [];
}

export function RoleManagement() {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>(ROLES.MEMBER);
  const currentUserRole: Role = ROLES.OWNER;

  useEffect(() => {
    setMembers(getMembers());
    setIsLoading(false);
  }, []);

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const newMember: Member = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: inviteEmail.split("@")[0],
      email: inviteEmail.trim(),
      role: inviteRole,
      joinedAt: new Date().toISOString(),
    };

    const updated = [...members, newMember];
    setMembers(updated);
    saveMembers(updated);
    setInviteEmail("");
    setInviteRole(ROLES.MEMBER);
    setInviteOpen(false);
    toast.success(`Invitation sent to ${inviteEmail}`);
  }

  function handleRoleChange(memberId: string, newRole: Role) {
    if (!hasPermission(currentUserRole, PERMISSIONS.MEMBERS_CHANGE_ROLE)) {
      toast.error("You don't have permission to change roles.");
      return;
    }
    const updated = members.map((m) =>
      m.id === memberId ? { ...m, role: newRole } : m,
    );
    setMembers(updated);
    saveMembers(updated);
    toast.success("Role updated successfully");
  }

  function handleRemoveMember(memberId: string) {
    const updated = members.filter((m) => m.id !== memberId);
    setMembers(updated);
    saveMembers(updated);
    toast.success("Member removed from workspace");
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const assignableRoles = getAssignableRoles(currentUserRole);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Team Members</h3>
          <p className="text-muted-foreground text-sm">
            Manage who has access to this workspace.
          </p>
        </div>
        {hasPermission(currentUserRole, PERMISSIONS.MEMBERS_INVITE) && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite team member</DialogTitle>
                <DialogDescription>
                  Invite a new member to collaborate on this workspace.
                </DialogDescription>
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
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          <div>
                            <p>{ROLE_LABELS[role]}</p>
                            <p className="text-muted-foreground text-xs">{ROLE_DESCRIPTIONS[role]}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Send Invitation</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-sm">Member</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Role</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {member.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-muted-foreground text-xs">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {hasPermission(currentUserRole, PERMISSIONS.MEMBERS_CHANGE_ROLE) && member.id !== "dev-user-123" ? (
                    <Select
                      value={member.role}
                      onValueChange={(v) => handleRoleChange(member.id, v as Role)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
                      <Shield className="size-3" />
                      {ROLE_LABELS[member.role]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-sm">
                  {new Date(member.joinedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {hasPermission(currentUserRole, PERMISSIONS.MEMBERS_REMOVE) && member.id !== "dev-user-123" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
