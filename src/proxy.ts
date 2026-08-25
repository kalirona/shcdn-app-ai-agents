import { type NextRequest, NextResponse } from "next/server";

import { SUPABASE_ACCESS_TOKEN_SKEW_MS } from "@/lib/auth/provider";
import { hasSupabaseSessionCookie, isSupabaseSessionNearExpiry } from "@/lib/auth/supabase-cookie";

const PUBLIC_PATHS = ["/", "/auth", "/unauthorized", "/widget", "/a", "/api"];
const AUTH_PATHS = ["/auth/v1/login", "/auth/v1/register", "/auth/v1/forgot-password"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => {
    if (p === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(p);
  });
}

/**
 * Supabase-only session check. The Edge runtime cannot read non-NEXT_PUBLIC env
 * vars (AUTH_PROVIDER is not available), and legacy directus_session cookies are
 * deliberately NOT recognized here: a stale/forged legacy cookie must never gate
 * a route or trigger the refresh flow under AUTH_PROVIDER=supabase.
 */
function hasSession(request: NextRequest): boolean {
  return hasSupabaseSessionCookie(request.cookies.getAll());
}

function isSessionNearExpiry(request: NextRequest): boolean {
  return isSupabaseSessionNearExpiry(request.cookies.getAll(), SUPABASE_ACCESS_TOKEN_SKEW_MS);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = isPublicPath(pathname);
  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p));

  // Session cookie presence gates route access; actual validation happens
  // server-side in getAuthContext(). Near-expiry *navigations* are forwarded to
  // the /api/auth/session route handler, which is allowed to write cookies, so
  // the access-token rotation cannot hit Next's readonly-cookie restriction
  // during render. The handler redirects back on success or clears to sign-in
  // on failure, which also breaks the proxy<->layout redirect loop.
  //
  // Only GET requests are diverted. Server Actions and other POSTs must flow
  // through untouched: a 307 here would make the App Router re-issue the action
  // against the route handler, corrupting the reference ID / RSC protocol
  // ("Server Reference ID ... Received 'x'", "router state header ... could not
  // be parsed", missing-origin warnings). A POST with an actually-dead token
  // instead fails inside the action's own auth guard, which is handled normally.
  const authenticated = hasSession(request);

  if (authenticated && isAuthPath) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!authenticated && !isPublic) {
    return NextResponse.redirect(new URL("/auth/v1/login", request.url));
  }

  if (authenticated && !isPublic && request.method === "GET" && isSessionNearExpiry(request)) {
    const session = new URL("/api/auth/session", request.url);
    session.searchParams.set("next", pathname);
    return NextResponse.redirect(session);
  }

  // Forward the requested pathname so layouts can redirect back to it after
  // the session handler completes (layouts do not receive the URL).
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
