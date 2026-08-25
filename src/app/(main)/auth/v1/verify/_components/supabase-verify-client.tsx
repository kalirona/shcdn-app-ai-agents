"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

import { verifyEmailTokenAction } from "../_actions";

/**
 * Verifies the links GoTrue emails to users at /auth/v1/verify.
 *
 * This self-hosted GoTrue uses the IMPLICIT flow: its /auth/v1/verify?token=...
 * endpoint responds with a 302 to THIS page carrying the session tokens in the
 * URL fragment (#access_token=...&refresh_token=...&type=recovery). Fragments
 * are never sent to the server, so verification must happen in the browser:
 * supabase.auth.setSession() on the existing @supabase/ssr browser client
 * persists the session into the same sb-* cookies the SSR layer reads. No
 * localStorage is used and no token is ever logged.
 *
 * OTP-style links (token_hash as a query parameter) are still supported via
 * verifyEmailTokenAction so a future GoTrue/PKCE switch keeps working.
 */
export function VerifyClient() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fail = () => {
      if (!cancelled) {
        setFailed(true);
      }
    };

    async function verify() {
      const hash = new URLSearchParams(
        window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash,
      );

      // Strip the fragment immediately so tokens never linger in the address
      // bar, browser history entries created afterwards, or referrer headers.
      history.replaceState(null, "", window.location.pathname + window.location.search);

      const error = hash.get("error_description") ?? hash.get("error") ?? hash.get("error_code");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const type = hash.get("type") ?? "";

      // GoTrue signals an unusable link (expired/consumed) in the fragment.
      if (error) {
        router.replace("/auth/v1/login?error=invalid_link");
        return;
      }

      // Implicit flow: exchange the fragment tokens for the SSR cookie session.
      if (accessToken && refreshToken) {
        const supabase = createBrowserSupabaseClient();
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          fail();
          return;
        }
        router.replace(type === "recovery" ? "/auth/v1/reset-password" : "/dashboard");
        return;
      }

      // OTP-style flow: token arrives as a query parameter; verify server-side
      // through the existing SSR architecture (cookie writes allowed in actions).
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash") ?? params.get("token");
      const queryType = params.get("type");
      if (tokenHash && queryType) {
        const result = await verifyEmailTokenAction(tokenHash, queryType);
        if (result.ok) {
          router.replace(result.type === "recovery" ? "/auth/v1/reset-password" : "/dashboard");
          return;
        }
      }

      fail();
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {failed ? (
              "Invalid link"
            ) : (
              <>
                <Loader2 className="size-4 animate-spin" />
                Verifying your link…
              </>
            )}
          </CardTitle>
        </CardHeader>
        {failed ? (
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground text-sm">
              This email link is invalid or has expired. Please request a new one.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/v1/login">Back to sign in</Link>
            </Button>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
