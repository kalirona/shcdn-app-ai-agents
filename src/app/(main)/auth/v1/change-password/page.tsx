import { getAuthContext } from "@/lib/auth/auth-context";
import { isSupabase } from "@/lib/auth/provider";

import { SupabaseChangePasswordForm } from "./_components/supabase-change-password-form";
import { DirectusChangePasswordForm } from "./_components/directus-change-password-form";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const { isAuthenticated } = await getAuthContext();

  if (!isAuthenticated) {
    return (
      <html lang="en">
        <body className="flex min-h-screen items-center justify-center bg-background">
          <div className="p-8 text-center">
            <h1 className="mb-2 font-semibold text-3xl">Sign in required</h1>
            <p className="text-muted-foreground">
              Please sign in to change your password.
            </p>
            <a href="/auth/v1/login" className="mt-4 inline-block text-primary underline">
              Go to sign in
            </a>
          </div>
        </body>
      </html>
    );
  }

  return isSupabase() ? <SupabaseChangePasswordForm /> : <DirectusChangePasswordForm />;
}