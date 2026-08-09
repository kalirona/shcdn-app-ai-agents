"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Building2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createWorkspace } from "@/lib/auth/actions/workspace.actions";

export default function CreateWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await createWorkspace({ name, description, website });

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="size-6 text-primary" />
          </div>
          <CardTitle>Create your workspace</CardTitle>
          <CardDescription>
            A workspace is where you manage your AI agents, conversations, and team members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                placeholder="Acme Inc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
                minLength={2}
                maxLength={64}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-description">Description (optional)</Label>
              <Textarea
                id="workspace-description"
                placeholder="What does your business do?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={2}
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-website">Website (optional)</Label>
              <Input
                id="workspace-website"
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={isLoading}
                maxLength={256}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              Create workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
