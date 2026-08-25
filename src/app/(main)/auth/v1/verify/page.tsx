import { VerifyClient } from "./_components/supabase-verify-client";

export const dynamic = "force-dynamic";

/**
 * Handles the links GoTrue emails to users (email confirmation, password
 * recovery, invites, email changes) at /auth/v1/verify.
 *
 * This self-hosted GoTrue uses the implicit flow: tokens arrive in the URL
 * fragment (#access_token=...), which only the browser can read, so the actual
 * verification runs in supabase-verify-client. See that component for details.
 */
export default function VerifyPage() {
  return <VerifyClient />;
}
