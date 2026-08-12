import { getLogtoContext } from "@logto/next/server-actions";

import { isSuperAdmin as checkIsSuperAdmin } from "@/lib/db/repositories/platform-role.repo";

import { logtoConfig } from "./logto-config";
import type { User } from "./types";

// No hardcoded user fallback. Identity always comes from the authenticated
// Logto session. In local development without Logto configured, we return an
// explicitly-configured dev identity when provided via env, otherwise the
// context is simply unauthenticated (the UI handles the empty state).
const isLocalDev = process.env.NODE_ENV === "development" && !process.env.LOGTO_ENDPOINT;

function getDevUser(): User | null {
  if (!isLocalDev) return null;
  const id = process.env.DEV_USER_ID;
  const email = process.env.DEV_USER_EMAIL;
  const name = process.env.DEV_USER_NAME;
  if (!id && !email && !name) return null;
  return {
    id: id ?? "local-dev-user",
    email: email ?? "local@dev",
    name: name ?? null,
    avatar: null,
  };
}

export async function getAuthContext(): Promise<{
  isAuthenticated: boolean;
  user: User | null;
  isSuperAdmin: boolean;
}> {
  const devUser = getDevUser();
  if (devUser) {
    const isSuperAdmin = await checkIsSuperAdmin(devUser.id).catch(() => false);
    return {
      isAuthenticated: true,
      user: devUser,
      isSuperAdmin,
    };
  }

  try {
    const context = await getLogtoContext(logtoConfig, {
      getAccessToken: false,
      fetchUserInfo: true,
    });

    // TEMP DIAGNOSTIC: log the identity Logto actually returned so we can
    // confirm whether the dashboard is showing the real registered user.
    // TODO: remove after confirming the identity bug is resolved.
    console.log(
      "[auth-context] resolved =",
      JSON.stringify({
        env: process.env.NODE_ENV,
        isAuthenticated: context.isAuthenticated,
        sub: context.claims?.sub ?? null,
        email: context.claims?.email ?? null,
        name: context.claims?.name ?? null,
        picture: context.claims?.picture ?? null,
        allClaims: context.claims ? Object.keys(context.claims) : null,
      }),
    );

    let isSuperAdmin = false;
    if (context.isAuthenticated && context.claims?.sub) {
      isSuperAdmin = await checkIsSuperAdmin(context.claims.sub).catch(() => false);
    }

    return {
      isAuthenticated: context.isAuthenticated,
      user: context.claims
        ? {
            id: context.claims.sub,
            email: context.claims.email ?? "",
            name: context.claims.name ?? null,
            avatar: context.claims.picture ?? null,
          }
        : null,
      isSuperAdmin,
    };
  } catch (error) {
    // TEMP DIAGNOSTIC: log the failure too.
    console.error("[auth-context] ERROR resolving identity:", error);
    return {
      isAuthenticated: false,
      user: null,
      isSuperAdmin: false,
    };
  }
}
