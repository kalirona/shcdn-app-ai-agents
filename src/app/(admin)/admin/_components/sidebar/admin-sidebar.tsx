"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Shield } from "lucide-react";

import {
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

interface AdminSidebarProps extends React.ComponentProps<typeof import("@/components/ui/sidebar").Sidebar> {
  user: { id: string; email: string; name: string | null; avatar: string | null };
}

export function AdminSidebar({ user, ...props }: AdminSidebarProps) {
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
    <>
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
              {group.items.map((item) => (
                <AdminNavItem
                  key={item.id}
                  item={item}
                  isActive={isItemActive(item)}
                  showIconFallback={isCollapsedDesktop}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

interface AdminNavItemProps {
  item: NavMainItem;
  isActive: boolean;
  showIconFallback: boolean;
}

function AdminNavItem({ item, isActive, showIconFallback }: AdminNavItemProps) {
  if (hasSubItems(item)) {
    return null;
  }

  const _Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild aria-disabled={item.disabled} tooltip={item.title} isActive={isActive}>
        <Link
          prefetch={false}
          href={item.url}
          target={item.newTab ? "_blank" : undefined}
          rel={item.newTab ? "noreferrer" : undefined}
        >
          <AdminNavLinkIcon item={item} showFallback={showIconFallback} />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
      <AdminNavItemBadge badge={item.badge} />
    </SidebarMenuItem>
  );
}

function AdminNavLinkIcon({ item, showFallback }: { item: NavMainLinkItem; showFallback: boolean }) {
  const Icon = item.icon;

  if (Icon) {
    return <Icon />;
  }

  if (showFallback) {
    return <CollapsedIconFallback title={item.title} />;
  }

  return null;
}

function CollapsedIconFallback({ title }: { title: string }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-xs font-medium text-[10px] outline">
      {title.slice(0, 1)}
    </span>
  );
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
