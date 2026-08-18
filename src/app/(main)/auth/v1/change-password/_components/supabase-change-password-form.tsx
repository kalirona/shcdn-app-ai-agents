"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";

import Link from "next/link";

import { Loader2, ShieldAlert, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/lib/auth/actions/change-password.action";

export function SupabaseChangePasswordForm() {
  const searchParams = useSearchParams();
  const recovery = searchParams.get("recovery") === "true";

  const [state, formAction, pending] = useActionState(changePasswordAction, null);

  const showCurrentPassword = !recovery;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{recovery ? "Reset your password" : "Change your password"}</CardTitle>
          <CardDescription>
            {recovery
              ? "Enter your new password below. Your recovery session is active."
              : "Enter your current password and a new one."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {showCurrentPassword && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  disabled={pending}
                  aria-invalid={!!state?.error}
                />
              </div>
            )}

            <input type="hidden" name="recovery" value={recovery.toString()} />

            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete={recovery ? "new-password" : "new-password"}
                placeholder="At least 8 characters"
                required
                disabled={pending}
                minLength={8}
                aria-invalid={!!state?.error}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete={recovery ? "new-password" : "new-password"}
                placeholder="••••••••"
                required
                disabled={pending}
                aria-invalid={!!state?.error}
              />
            </div>

            {state?.error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive text-sm"
              >
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>{state.error}</span>
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {recovery ? "Resetting..." : "Changing..."}
                </>
              ) : (
                recovery ? "Reset password" : "Change password"
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-muted-foreground text-sm">
            <Link href="/dashboard" className="font-medium underline underline-offset-4">
              Back to dashboard
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}