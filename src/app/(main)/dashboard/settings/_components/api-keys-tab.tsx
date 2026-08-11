"use client";

import { useState } from "react";

import { Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ApiKey {
  id: string;
  name: string;
  lastFour: string;
  createdAt: string;
}

const DEMO_KEYS: ApiKey[] = [{ id: "1", name: "Production", lastFour: "8f2a", createdAt: new Date().toISOString() }];

export function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>(DEMO_KEYS);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsCreating(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setKeys((prev) => [
      {
        id: `${Date.now()}`,
        name: name.trim(),
        lastFour: Math.random().toString(16).slice(2, 6),
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setNewKey(`ak_live_${Math.random().toString(36).slice(2, 14)}${Math.random().toString(36).slice(2, 14)}`);
    setIsCreating(false);
  }

  function copyKey() {
    if (!newKey) return;
    void navigator.clipboard.writeText(newKey);
    toast.success("API key copied to clipboard");
  }

  function handleDelete(id: string) {
    setKeys((prev) => prev.filter((k) => k.id !== id));
    toast.success("API key revoked");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">API Keys</h3>
          <p className="text-muted-foreground text-sm">
            Keys used to authenticate requests to the Agent AI API. Keep them secret.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setNewKey(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{newKey ? "Your API key" : "Create a new API key"}</DialogTitle>
              <DialogDescription>
                {newKey
                  ? "Copy this key now. You won't be able to see it again."
                  : "Give this key a name so you can remember what it's for."}
              </DialogDescription>
            </DialogHeader>
            {newKey ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-3">
                  <code className="break-all text-sm">{newKey}</code>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={copyKey}>
                    <Copy />
                    Copy
                  </Button>
                  <Button onClick={() => setOpen(false)}>Done</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key-name">Key name</Label>
                  <Input
                    id="api-key-name"
                    placeholder="e.g. Production, Staging, CI"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isCreating}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating || !name.trim()}>
                    {isCreating && <Loader2 className="size-4 animate-spin" />}
                    Create Key
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <KeyRound className="size-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No API keys yet</p>
          <p className="text-muted-foreground text-sm">Create a key to start using the API.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{key.name}</p>
                  <Badge variant="secondary" className="text-xs">
                    ••••{key.lastFour}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">Created {new Date(key.createdAt).toLocaleDateString()}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(key.id)} title="Revoke key">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
