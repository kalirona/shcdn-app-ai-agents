"use client";

import { Suspense, useState, useTransition } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { changePasswordAction } from "@/lib/auth/actions/change-password.action";

function PasswordInput({
  label,
  name,
  value,
  onChange,
  type,
  onToggle,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type: "password" | "text";
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <Input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="pr-10"
          autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          disabled={disabled}
        >
          {type === "password" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense>
      <ChangePasswordForm />
    </Suspense>
  );
}

function ChangePasswordForm() {
  const searchParams = useSearchParams();
  const recoveryMode = searchParams.get("recovery") === "true";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await changePasswordAction(null, formData);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            {recoveryMode ? "Reset Password" : "Change Password"}
          </CardTitle>
          <CardDescription>
            {recoveryMode
              ? "Choose a new password for your account."
              : "You are required to change your password before continuing."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <input type="hidden" name="recovery" value={recoveryMode ? "true" : "false"} />
            {!recoveryMode && (
              <PasswordInput
                label="Current password"
                name="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                type={showCurrent ? "text" : "password"}
                onToggle={() => setShowCurrent(!showCurrent)}
                disabled={isPending}
              />
            )}
            <PasswordInput
              label="New password"
              name="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type={showNew ? "text" : "password"}
              onToggle={() => setShowNew(!showNew)}
              disabled={isPending}
            />
            <div className="text-xs text-muted-foreground">Must be at least 8 characters.</div>
            <PasswordInput
              label="Confirm new password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type={showConfirm ? "text" : "password"}
              onToggle={() => setShowConfirm(!showConfirm)}
              disabled={isPending}
            />
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" form="change-password-form" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
            {isPending ? "Updating..." : "Change Password"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/auth/v1/login" className="underline hover:text-foreground">
              Back to sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
