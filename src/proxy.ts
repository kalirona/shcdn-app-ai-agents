import { type NextRequest, NextResponse } from "next/server";

const isLocalDev = process.env.NODE_ENV === "development" && !process.env.LOGTO_ENDPOINT;

const PUBLIC_PATHS = ["/", "/auth", "/callback", "/unauthorized", "/widget", "/a", "/api"];
const AUTH_PATHS = ["/auth/v1/login", "/auth/v1/register", "/callback"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => {
    if (p === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(p);
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = isPublicPath(pathname);
  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (isLocalDev) {
    if (isAuthPath) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  try {
    const LogtoClient = (await import("@logto/next/edge")).default;
    const { logtoConfig } = await import("@/lib/auth/logto-config");
    const client = new LogtoClient(logtoConfig);

    const context = await client.getLogtoContext(request, {
      getAccessToken: false,
      fetchUserInfo: false,
    });

    if (context.isAuthenticated && isAuthPath) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (!context.isAuthenticated && !isPublic) {
      return NextResponse.redirect(new URL("/auth/v1/login", request.url));
    }
  } catch {
    if (!isPublic) {
      return NextResponse.redirect(new URL("/auth/v1/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
