"use client";

import { useEffect, useState } from "react";

import { Globe, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateWorkspace } from "@/lib/auth/actions/workspace.actions";

const WORKSPACE_ID = "placeholder-workspace-id";

export function BusinessProfileForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    // TODO: Load from Directus
  }, []);

  function markDirty() {
    setIsDirty(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    const result = await updateWorkspace(WORKSPACE_ID, {
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

    setIsLoading(false);
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
              disabled={isLoading}
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
              disabled={isLoading}
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
                disabled={isLoading}
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading || !isDirty}>
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              <Save />
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
