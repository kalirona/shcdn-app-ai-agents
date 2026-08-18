"use client";

import Link from "next/link";

import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DirectusForgotPasswordRedirect() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Password resets are handled by your workspace administrator</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-muted-foreground text-sm">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              Self-service password reset is only available when the application uses the Supabase identity
              provider. Ask your administrator for assistance.
            </span>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/v1/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}