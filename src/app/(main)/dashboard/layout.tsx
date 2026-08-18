import type { ReactNode } from "react";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";
import { DIRECTUS_SESSION_COOKIE, isSupabase } from "@/lib/auth/provider";
import { hasSupabaseSessionCookie } from "@/lib/auth/supabase-cookie";
import { cn } from "@/lib/utils";
import { getPreference } from "@/server/server-actions";

import { AccountSwitcher } from "./_components/header/account-switcher";
import { LayoutControls } from "./_components/header/layout-controls";
import { SearchDialog } from "./_components/header/search-dialog";
import { ThemeSwitcher } from "./_components/header/theme-switcher";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const [variant, collapsible] = await Promise.all([
    getPreference("sidebar_variant"),
    getPreference("sidebar_collapsible"),
  ]);
  const currentUser = await getCurrentUser();

  // Enforce authentication. When the session cookie exists but the user could
  // not be resolved (access token inside the refresh skew window, or rotated by
  // a concurrent request), route through /api/auth/session — the one context
  // allowed to write cookies in Next.js. Sending the user straight to sign-in
  // here would loop: the middleware sees the cookie, bounces back to dashboard,
  // and this layout bounces to /auth/v1/login again.
  if (!currentUser.user.id) {
    const hasSessionCookie = isSupabase()
      ? hasSupabaseSessionCookie(cookieStore.getAll())
      : Boolean(cookieStore.get(DIRECTUS_SESSION_COOKIE)?.value);
    if (hasSessionCookie) {
      const headerList = await headers();
      const pathname = headerList.get("x-pathname") ?? "/dashboard";
      redirect(`/api/auth/session?next=${encodeURIComponent(pathname)}`);
    }
    redirect("/auth/v1/login");
  }

  // Force password reset flow: if admin flagged the user, send them to change-password page
  if (currentUser.user.forcePasswordReset) {
    const headerList = await headers();
    const pathname = headerList.get("x-pathname") ?? "/dashboard";
    // Allow the change-password page itself to render (avoid redirect loop)
    if (!pathname.startsWith("/auth/v1/change-password")) {
      redirect(`/auth/v1/change-password?next=${encodeURIComponent(pathname)}`);
    }
  }

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant={variant} collapsible={collapsible} user={currentUser.user} />
      <SidebarInset
        className={cn(
          "[html[data-content-layout=centered]_&>*]:mx-auto",
          "[html[data-content-layout=centered]_&>*]:w-full",
          "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
          "peer-data-[variant=inset]:border",
          "[--dashboard-header-height:--spacing(12)]",
          "min-w-0 overflow-x-clip",
        )}
      >
        <header
          className={cn(
            "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
            // Handle sticky navbar style with conditional classes so blur, background, z-index, and rounded corners remain consistent across all SidebarVariant layouts.
            "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
          )}
        >
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
              />
              <SearchDialog />
            </div>
            <div className="flex items-center gap-2">
              <LayoutControls />
              <ThemeSwitcher />
              <AccountSwitcher user={currentUser.user} />
            </div>
          </div>
        </header>
        {/* Pages can set data-content-padding="false" to render full-bleed app layouts. */}
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
