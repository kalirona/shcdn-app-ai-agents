"use client";

import { useState, useTransition } from "react";

import { Loader2, Pencil, Plus, RefreshCw, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AI_CAPABILITIES, PROVIDER_DEFINITIONS } from "@/lib/ai/registry";
import {
  getAdminAIModels,
  getAdminAIProviders,
  removeProvider,
  saveProvider,
  syncProviderModels,
  testProviderConnection,
  toggleProviderEnabled,
} from "@/lib/auth/actions/admin/ai.actions";
import type { AIProviderKey, AIProviderType } from "@/lib/db/entities";
import type { AIModelSafe } from "@/lib/db/repositories/ai-model.repo";
import type { AIProviderSafe } from "@/lib/db/repositories/ai-provider.repo";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ok: "default",
  error: "destructive",
  untested: "secondary",
};

interface Props {
  initialProviders: AIProviderSafe[];
  initialModels: AIModelSafe[];
}

interface EditorState {
  provider?: AIProviderSafe;
  providerKey: AIProviderKey;
  name: string;
  type: AIProviderType;
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  priority: number;
  defaultModel: string;
  capabilities: string[];
  discoverable: boolean;
}

const EMPTY_EDITOR: Omit<EditorState, "providerKey" | "name" | "type"> = {
  apiKey: "",
  baseUrl: "",
  enabled: false,
  priority: 100,
  defaultModel: "",
  capabilities: ["chat"],
  discoverable: true,
};

export function AIProvidersSection({ initialProviders, initialModels }: Props) {
  const [providers, setProviders] = useState<AIProviderSafe[]>(initialProviders);
  const [models, setModels] = useState<AIModelSafe[]>(initialModels);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refreshData() {
    void Promise.all([getAdminAIProviders(), getAdminAIModels()]).then(([p, m]) => {
      setProviders(p);
      setModels(m);
    });
  }

  function toggleEnabled(provider: AIProviderSafe) {
    startTransition(async () => {
      const result = await toggleProviderEnabled({
        providerId: provider.id,
        enabled: !provider.enabled,
      });
      if (result.ok) {
        toast.success(`${provider.name} ${provider.enabled ? "disabled" : "enabled"}`);
        refreshData();
      } else {
        toast.error(result.error);
      }
    });
  }

  function testConnection(provider: AIProviderSafe) {
    setBusyProviderId(provider.id);
    startTransition(async () => {
      const result = await testProviderConnection({ providerId: provider.id });
      setBusyProviderId(null);
      if (result.ok) {
        toast.success(`Connection OK — ${result.data.modelCount} models available.`);
      } else {
        toast.error(result.error);
      }
      refreshData();
    });
  }

  function syncModels(provider: AIProviderSafe) {
    setBusyProviderId(provider.id);
    startTransition(async () => {
      const result = await syncProviderModels({ providerId: provider.id });
      setBusyProviderId(null);
      if (result.ok) {
        toast.success(`Synced ${result.data.added} models from ${provider.name}.`);
      } else {
        toast.error(result.error);
      }
      refreshData();
    });
  }

  function deleteCustom(provider: AIProviderSafe) {
    startTransition(async () => {
      const result = await removeProvider({ providerId: provider.id });
      if (result.ok) {
        toast.success(`Removed ${provider.name}.`);
        refreshData();
      } else {
        toast.error(result.error);
      }
    });
  }

  function saveEditor() {
    if (!editor) return;
    startTransition(async () => {
      const result = await saveProvider({
        id: editor.provider?.id,
        providerKey: editor.providerKey,
        name: editor.name,
        type: editor.type,
        apiKey: editor.apiKey,
        baseUrl: editor.baseUrl,
        enabled: editor.enabled,
        priority: editor.priority,
        defaultModel: editor.defaultModel,
        capabilities: editor.capabilities as never,
        discoverable: editor.discoverable,
      });
      if (result.ok) {
        toast.success("Provider saved.");
        setEditor(null);
        refreshData();
      } else {
        toast.error(result.error);
      }
    });
  }

  function openNew() {
    setEditor({
      providerKey: "custom",
      name: "",
      type: "openai",
      ...EMPTY_EDITOR,
    });
  }

  function openEdit(provider: AIProviderSafe) {
    setEditor({
      provider: provider,
      providerKey: provider.provider_key,
      name: provider.name,
      type: provider.type,
      apiKey: "",
      baseUrl: provider.baseUrl ?? "",
      enabled: provider.enabled,
      priority: provider.priority,
      defaultModel: provider.defaultModel ?? "",
      capabilities: [...provider.capabilities],
      discoverable: provider.discoverable,
    });
  }

  const modelCountByProvider = new Map<string, number>();
  for (const m of models) {
    modelCountByProvider.set(m.provider, (modelCountByProvider.get(m.provider) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="mr-1 size-3.5" />
          Add provider
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        {providers.map((provider, index) => {
          const isBuiltIn = Boolean(PROVIDER_DEFINITIONS[provider.provider_key]);
          const modelCount = modelCountByProvider.get(provider.id) ?? 0;
          return (
            <div
              key={provider.id}
              className={cn("flex items-center justify-between gap-4 bg-background p-4", index > 0 && "border-t")}
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Zap className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{provider.name}</p>
                    <Badge variant={STATUS_VARIANT[provider.status]} className="text-[10px]">
                      {provider.status}
                    </Badge>
                    {!isBuiltIn && (
                      <Badge variant="outline" className="text-[10px]">
                        custom
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-muted-foreground text-sm">
                    {provider.hasApiKey ? `API key ${provider.apiKeyHint}` : "No API key"} · priority{" "}
                    {provider.priority}
                    {modelCount > 0 && ` · ${modelCount} models`}
                  </p>
                  {provider.lastError && <p className="mt-1 truncate text-destructive text-xs">{provider.lastError}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {provider.capabilities.map((cap) => (
                      <Badge key={cap} variant="secondary" className="text-[10px]">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {provider.discoverable && (
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Sync models"
                    disabled={busyProviderId === provider.id}
                    onClick={() => syncModels(provider)}
                  >
                    <RefreshCw className={cn("size-4", busyProviderId === provider.id && "animate-spin")} />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  title="Test connection"
                  disabled={busyProviderId === provider.id}
                  onClick={() => testConnection(provider)}
                >
                  {busyProviderId === provider.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Zap className="size-4" />
                  )}
                </Button>
                <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(provider)}>
                  <Pencil className="size-4" />
                </Button>
                {!isBuiltIn && (
                  <Button size="icon" variant="ghost" title="Remove" onClick={() => deleteCustom(provider)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
                <Label htmlFor={`provider-${provider.id}`} className="sr-only">
                  {provider.name}
                </Label>
                <Switch
                  id={`provider-${provider.id}`}
                  checked={provider.enabled}
                  onCheckedChange={() => toggleEnabled(provider)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editor?.provider ? "Edit provider" : "Add provider"}</DialogTitle>
            <DialogDescription>
              Configure the provider connection. API keys are stored encrypted-side and masked in the UI.
            </DialogDescription>
          </DialogHeader>

          {editor && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="p-name">Name</Label>
                  <Input
                    id="p-name"
                    value={editor.name}
                    onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                    placeholder="My Provider"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-key">Provider key</Label>
                  <Input
                    id="p-key"
                    value={editor.providerKey}
                    disabled={Boolean(editor.provider)}
                    onChange={(e) => setEditor({ ...editor, providerKey: e.target.value as AIProviderKey })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-url">Base URL</Label>
                <Input
                  id="p-url"
                  value={editor.baseUrl}
                  onChange={(e) => setEditor({ ...editor, baseUrl: e.target.value })}
                  placeholder={PROVIDER_DEFINITIONS[editor.providerKey]?.defaultBaseUrl ?? "https://..."}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-api-key">
                  {editor.provider?.hasApiKey ? `API key (current: ${editor.provider.apiKeyHint})` : "API key"}
                </Label>
                <Input
                  id="p-api-key"
                  type="password"
                  value={editor.apiKey}
                  onChange={(e) => setEditor({ ...editor, apiKey: e.target.value })}
                  placeholder={editor.provider?.hasApiKey ? "Leave blank to keep" : "sk-..."}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="p-default-model">Default model</Label>
                  <Input
                    id="p-default-model"
                    value={editor.defaultModel}
                    onChange={(e) => setEditor({ ...editor, defaultModel: e.target.value })}
                    placeholder="model-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-priority">Priority</Label>
                  <Input
                    id="p-priority"
                    type="number"
                    min={0}
                    max={9999}
                    value={editor.priority}
                    onChange={(e) => setEditor({ ...editor, priority: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Capabilities</Label>
                <div className="flex flex-wrap gap-2">
                  {AI_CAPABILITIES.map((cap) => {
                    const active = editor.capabilities.includes(cap.value);
                    return (
                      <Button
                        key={cap.value}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        onClick={() =>
                          setEditor({
                            ...editor,
                            capabilities: active
                              ? editor.capabilities.filter((c) => c !== cap.value)
                              : [...editor.capabilities, cap.value],
                          })
                        }
                      >
                        {cap.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Enabled</p>
                  <p className="text-muted-foreground text-sm">Allow the platform to use this provider.</p>
                </div>
                <Switch checked={editor.enabled} onCheckedChange={(v) => setEditor({ ...editor, enabled: v })} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditor} disabled={isPending}>
              {isPending ? "Saving..." : "Save provider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
