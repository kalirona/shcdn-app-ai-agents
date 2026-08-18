import { isSuperAdmin as checkIsSuperAdmin } from "@/lib/db/repositories/platform-role.repo";

import { getCurrentDirectusUser, toAppUser } from "./directus-auth";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { isSupabase } from "./provider";
import type { User } from "./types";

// No hardcoded user fallback. Identity always comes from the authenticated
// session of the active provider (Directus or Supabase). An unset or invalid
// AUTH_PROVIDER is a fatal configuration error (see provider.ts).

export async function getAuthContext(): Promise<{
  isAuthenticated: boolean;
  user: User | null;
  isSuperAdmin: boolean;
}> {
  try {
    if (isSupabase()) {
      const supabaseUser = await getCurrentSupabaseUser();

      if (!supabaseUser) {
        return {
          isAuthenticated: false,
          user: null,
          isSuperAdmin: false,
        };
      }

      const user: User = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.name,
        avatar: supabaseUser.avatar,
        forcePasswordReset: supabaseUser.forcePasswordReset,
      };
      const isSuperAdmin = await checkIsSuperAdmin(user.id).catch(() => false);

      return {
        isAuthenticated: true,
        user,
        isSuperAdmin,
      };
    }

    const directusUser = await getCurrentDirectusUser();

    if (!directusUser) {
      return {
        isAuthenticated: false,
        user: null,
        isSuperAdmin: false,
      };
    }

    const user = toAppUser(directusUser);
    const isSuperAdmin = await checkIsSuperAdmin(user.id).catch(() => false);

    return {
      isAuthenticated: true,
      user,
      isSuperAdmin,
    };
  } catch (error) {
    console.error("[auth-context] ERROR resolving identity:", error);
    return {
      isAuthenticated: false,
      user: null,
      isSuperAdmin: false,
    };
  }
}