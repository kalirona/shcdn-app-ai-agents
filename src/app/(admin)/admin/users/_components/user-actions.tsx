"use client";

import * as React from "react";

import { AlertTriangle, Ban, Lock, RefreshCw, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  activateUser,
  banUser,
  deleteUserAction,
  forcePasswordResetAction,
  resetUserPasswordAction,
  suspendUser,
  unbanUser,
} from "@/lib/auth/actions/admin/users.actions";

interface UserActionsProps {
  user: {
    id: string;
    email: string;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    status: string;
    platformBanned: boolean;
    forcePasswordReset: boolean;
  };
}

function ActionIcon({ icon: Icon }: { icon?: React.ElementType }) {
  if (!Icon) return null;
  return <Icon className="mr-2 h-4 w-4" />;
}

export function UserActions({ user }: UserActionsProps) {
  const [isPending, setIsPending] = React.useState<string | null>(null);

  const isActive = user.status === "active";
  const isBanned = user.platformBanned;
  const isSuspended = user.status === "suspended" && !user.platformBanned;

  async function handleAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    setIsPending(user.id);
    try {
      const result = await action();
      if (result.ok) {
        toast.success("Action completed");
      } else {
        toast.error(result.error ?? "Action failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setIsPending(null);
    }
  }

  const actions = [
    {
      label: isActive ? "Suspend" : "Activate",
      icon: isActive ? UserX : UserCheck,
      onClick: isActive
        ? () => handleAction(() => suspendUser(user.id))
        : () => handleAction(() => activateUser(user.id)),
      disabled: isBanned || isPending === user.id,
    },
    {
      label: isBanned ? "Unban" : "Ban",
      icon: isBanned ? Ban : AlertTriangle,
      variant: isBanned ? "default" : "destructive",
      onClick: isBanned
        ? () => handleAction(() => unbanUser(user.id))
        : () => {
            const reason = prompt("Ban reason (required):");
            if (reason?.trim()) handleAction(() => banUser(user.id, reason.trim()));
          },
      disabled: isPending === user.id,
    },
    { type: "separator" },
    {
      label: "Reset password",
      icon: Lock,
      onClick: () => {
        const newPassword = prompt("New password (min 8 chars):");
        if (newPassword && newPassword.length >= 8) {
          handleAction(() => resetUserPasswordAction(user.id, newPassword));
        } else if (newPassword) {
          toast.error("Password must be at least 8 characters");
        }
      },
      disabled: isPending === user.id,
    },
    {
      label: user.forcePasswordReset ? "Clear force reset" : "Force password reset",
      icon: RefreshCw,
      onClick: () => {
        if (!user.forcePasswordReset) {
          if (confirm("Force user to change password on next login?"))
            handleAction(() => forcePasswordResetAction(user.id));
        } else {
          handleAction(() => forcePasswordResetAction(user.id));
        }
      },
      disabled: isPending === user.id,
    },
    { type: "separator" },
    {
      label: "Delete user",
      icon: Trash2,
      variant: "destructive",
      onClick: () => {
        if (confirm(`Delete ${user.email}? This cannot be undone.`)) handleAction(() => deleteUserAction(user.id));
      },
      disabled: isPending === user.id,
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending === user.id}>
          <span className="sr-only">User actions</span>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal text-xs opacity-70">Actions for {user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((action, i) =>
          action.type === "separator" ? (
            <DropdownMenuSeparator key={`sep-${i}`} />
          ) : (
            <DropdownMenuItem
              key={i}
              onClick={action.onClick}
              disabled={action.disabled}
              className={action.variant === "destructive" ? "text-destructive focus:text-destructive" : undefined}
            >
              <ActionIcon icon={action.icon} />
              {action.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
