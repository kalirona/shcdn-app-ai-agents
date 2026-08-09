import { getLogtoContext } from "@logto/next/server-actions";

import { logtoConfig } from "./logto-config";
import type { User } from "./types";

const isLocalDev = process.env.NODE_ENV === "development" && !process.env.LOGTO_ENDPOINT;

const mockUser: User = {
  id: "dev-user-123",
  email: "dev@localhost.com",
  name: "Dev User",
  avatar: null,
};

export async function getAuthContext(): Promise<{
  isAuthenticated: boolean;
  user: User | null;
}> {
  if (isLocalDev) {
    return {
      isAuthenticated: true,
      user: mockUser,
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
