"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Shield } from "lucide-react";

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { adminSidebarItems } from "@/navigation/sidebar/admin-sidebar-items";
import type { NavBadge, NavMainItem, NavMainLinkItem, NavMainParentItem } from "@/navigation/sidebar/sidebar-items";

function hasSubItems(item: NavMainItem): item is NavMainParentItem {
  return Boolean(item.subItems?.length);
}

interface AdminSidebarProps {
  variant: "sidebar" | "inset" | "floating";
  collapsible: "icon" | "offcanvas";
  user: { id: string; email: string; name: string | null; avatar: string | null };
}

export function AdminSidebar({ variant, collapsible, user }: AdminSidebarProps) {
  const { state, isMobile } = useSidebar();
  const path = usePathname();
  const isCollapsedDesktop = state === "collapsed" && !isMobile;

  const isItemActive = (item: NavMainItem) => {
    if (hasSubItems(item)) {
      return item.subItems.some((sub) => path === sub.url);
    }

    return path === item.url;
  };

  return (
    <Sidebar variant={variant} collapsible={collapsible}>
      <SidebarHeader className="border-b pb-2">
        <div className="flex flex-col gap-1.5 px-2">
          <span className="truncate font-semibold text-sm">SiteNexAI</span>
          <span className="truncate text-muted-foreground text-xs">Platform Admin</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              <SidebarMenuItem className="flex items-center gap-2">
                <SidebarMenuButton className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground">
                  <Shield className="size-4" />
                  <span className="group-data-[collapsible=icon]:hidden">Platform Admin</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {adminSidebarItems.map((group) => (
          <SidebarGroup key={group.id}>
            {group.label && (
              <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const linkItem = item as NavMainLinkItem;
                  return (
                    <SidebarMenuItem key={linkItem.id}>
                      <SidebarMenuButton asChild aria-disabled={linkItem.disabled} tooltip={linkItem.title} isActive={isItemActive(linkItem)}>
                        <Link
                          prefetch={false}
                          href={linkItem.url}
                          target={linkItem.newTab ? "_blank" : undefined}
                          rel={linkItem.newTab ? "noreferrer" : undefined}
                        >
                          <AdminNavLinkIcon item={linkItem} showFallback={isCollapsedDesktop} />
                          <span>{linkItem.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      <AdminNavItemBadge badge={linkItem.badge} />
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-medium text-xs">{user.name ?? user.email.split("@")[0]}</span>
            <span className="text-[10px] text-muted-foreground truncate">{user.email}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function AdminNavLinkIcon({ item, showFallback }: { item: NavMainLinkItem; showFallback: boolean }) {
  const Icon = item.icon;

  if (Icon) {
    return <Icon />;
  }

  if (showFallback) {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center rounded-xs font-medium text-[10px] outline">
        {item.title.slice(0, 1)}
      </span>
    );
  }

  return null;
}

function AdminNavItemBadge({ badge }: { badge?: NavBadge }) {
  if (!badge) return null;

  return (
    <span
      className={cn(
        "rounded-sm border px-1.5 text-[10px] capitalize",
        badge === "new" && "border-green-600 text-green-600",
        badge === "soon" && "border-muted-foreground text-muted-foreground",
      )}
    >
      {badge}
    </span>
  );
}