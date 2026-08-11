"use client";

import { useEffect, useState } from "react";

import { Globe, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";
import { updateWorkspace } from "@/lib/auth/actions/workspace.actions";

export function BusinessProfileForm() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await getCurrentUser();
        if (cancelled) return;
        const ws = result.currentWorkspace;
        if (ws) {
          setWorkspaceId(ws.id);
          setName(ws.name);
        }
      } catch {
        // ignore
      }
      if (!cancelled) setIsLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function markDirty() {
    setIsDirty(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    setIsSaving(true);

    const result = await updateWorkspace(workspaceId, {
      name: name || undefined,
      description: description || undefined,
      website: website || undefined,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Workspace settings updated.");
      setIsDirty(false);
    }

    setIsSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Profile</CardTitle>
        <CardDescription>
          Update your workspace information. This will appear across your AI agents and widget.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business name</Label>
            <Input
              id="business-name"
              placeholder="Acme Inc."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                markDirty();
              }}
              disabled={isLoading || isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-description">Description</Label>
            <Textarea
              id="business-description"
              placeholder="Brief description of your business..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markDirty();
              }}
              disabled={isLoading || isSaving}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-website">Website</Label>
            <div className="relative">
              <Globe className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                id="business-website"
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value);
                  markDirty();
                }}
                disabled={isLoading || isSaving}
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading || isSaving || !isDirty || !workspaceId}>
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              <Save />
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
