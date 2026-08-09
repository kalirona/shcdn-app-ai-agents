"use client";

import { Mail, Shield, User, UserMinus } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { removeMember } from "@/lib/auth/actions/workspace.actions";
import { type Membership, ROLE_LABELS } from "@/lib/auth/types";

const WORKSPACE_ID = "placeholder-workspace-id";

const mockMembers: Membership[] = [
  // Will be populated from Directus
];

function MemberRow({ membership }: { membership: Membership }) {
  const initials = (membership.name ?? membership.email).slice(0, 2).toUpperCase();

  async function handleRemove() {
    const result = await removeMember(WORKSPACE_ID, { membershipId: membership.id });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Member removed from workspace.");
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{membership.name ?? "Pending"}</p>
            <p className="text-muted-foreground text-xs">{membership.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
          {membership.role === "owner" ? <Shield className="size-3 text-primary" /> : <User className="size-3" />}
          {ROLE_LABELS[membership.role]}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{membership.joinedAt}</TableCell>
      <TableCell className="text-right">
        {membership.role !== "owner" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <UserMinus className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove member</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove {membership.name ?? membership.email} from this workspace? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </TableCell>
    </TableRow>
  );
}

export function MembersTable() {
  if (mockMembers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <Mail className="size-10 text-muted-foreground" />
        <p className="mt-3 font-medium">No team members yet</p>
        <p className="text-muted-foreground text-sm">Invite members to collaborate on this workspace.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockMembers.map((m) => (
            <MemberRow key={m.id} membership={m} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
