"use client";

import { useEffect, useState } from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInAction } from "@/lib/auth/auth-actions";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void signInAction();
    const timeout = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Redirecting to secure sign-in...</span>
            </div>
          ) : (
            <Button type="button" className="w-full" onClick={() => void signInAction()}>
              Sign in
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
