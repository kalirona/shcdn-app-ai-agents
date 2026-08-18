import { getPlatformSettings } from "@/lib/db/repositories/platform-settings.repo";
import { isSupabase } from "@/lib/auth/provider";

import { DirectusRegisterForm } from "./_components/directus-register-form";
import { DirectusRegisterRedirect } from "./_components/directus-register-redirect";
import { SupabaseRegisterForm } from "./_components/supabase-register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const settings = await getPlatformSettings();

  if (settings?.signup_enabled === false) {
    return <DirectusRegisterRedirect />;
  }
  return isSupabase() ? <SupabaseRegisterForm /> : <DirectusRegisterForm />;
}