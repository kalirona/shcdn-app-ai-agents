import { getLogtoContext } from "@logto/next/server-actions";

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
}> {
  const devUser = getDevUser();
  if (devUser) {
    return {
      isAuthenticated: true,
      user: devUser,
    };
  }

  try {
    const context = await getLogtoContext(logtoConfig, {
      getAccessToken: false,
      fetchUserInfo: true,
    });

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
    };
  } catch {
    return {
      isAuthenticated: false,
      user: null,
    };
  }
}
