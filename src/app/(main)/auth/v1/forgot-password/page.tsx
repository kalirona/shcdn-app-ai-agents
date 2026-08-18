import { isSupabase } from "@/lib/auth/provider";

import { DirectusForgotPasswordRedirect } from "./_components/directus-forgot-password-redirect";
import { SupabaseForgotPasswordForm } from "./_components/supabase-forgot-password-form";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return isSupabase() ? <SupabaseForgotPasswordForm /> : <DirectusForgotPasswordRedirect />;
}