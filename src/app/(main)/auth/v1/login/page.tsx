import { isSupabase } from "@/lib/auth/provider";

import { DirectusLoginForm } from "./_components/directus-login-form";
import { SupabaseLoginForm } from "./_components/supabase-login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return isSupabase() ? <SupabaseLoginForm /> : <DirectusLoginForm />;
}