"use client";

import { useActionState } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Loader2, Mail, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseSignInAction } from "@/lib/auth/auth-actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link: "This email link is invalid or has expired. Please request a new one.",
};

export function SupabaseLoginForm() {
  const searchParams = useSearchParams();
  const queryError = searchParams.get("error");
  const [state, formAction, pending] = useActionState(supabaseSignInAction, null);

  const errorMessage = state?.error ?? (queryError ? ERROR_MESSAGES[queryError] ?? null : null);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="pl-9"
                  required
                  disabled={pending}
                  aria-invalid={!!state?.error}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                disabled={pending}
                aria-invalid={!!state?.error}
              />
            </div>

            {errorMessage ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive text-sm"
              >
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-muted-foreground text-sm">
            <Link href="/auth/v1/forgot-password" className="font-medium underline underline-offset-4">
              Forgot your password?
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}