"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { ChevronsUpDown, Plus } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { getUserWorkspaces } from "@/lib/auth/actions/workspace.actions";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        const result = await getUserWorkspaces();
        if (result.workspaces && result.workspaces.length > 0) {
          setWorkspaces(result.workspaces as unknown as Workspace[]);
          setCurrentWorkspace(result.workspaces[0] as unknown as Workspace);
        }
      } catch {
        // ignore
      }
      setIsLoaded(true);
    };

    loadWorkspaces();
  }, []);

  if (!isLoaded) {
    return null;
  }

  if (workspaces.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/dashboard/workspace/create">
              <Plus />
              <span>Create Workspace</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const active = currentWorkspace ?? workspaces[0];
  const initials = active.name.charAt(0).toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{active.name}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" align="start">
            {workspaces.map((workspace) => (
              <DropdownMenuItem key={workspace.id} onClick={() => setCurrentWorkspace(workspace)}>
                <Avatar className="size-6 rounded">
                  <AvatarFallback className="rounded text-xs">{workspace.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span>{workspace.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/workspace/create">
                <Plus />
                Create Workspace
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
