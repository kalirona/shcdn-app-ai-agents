"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveAIDefaults } from "@/lib/auth/actions/admin/ai.actions";
import type { AIProviderKey } from "@/lib/db/entities";
import type { AIDefaultsSafe } from "@/lib/db/repositories/ai-defaults.repo";
import type { AIModelSafe } from "@/lib/db/repositories/ai-model.repo";
import type { AIProviderSafe } from "@/lib/db/repositories/ai-provider.repo";

interface Props {
  initialDefaults: AIDefaultsSafe;
  models: AIModelSafe[];
  providers: AIProviderSafe[];
}

type DefaultKey =
  | "chatModel"
  | "fastModel"
  | "visionModel"
  | "embeddingModel"
  | "imageModel"
  | "videoModel"
  | "fallbackModel";

const FIELDS: Array<{ key: DefaultKey; label: string; hint: string; capability: string }> = [
  { key: "chatModel", label: "Default Chat Model", hint: "Standard conversational agents.", capability: "chat" },
  { key: "fastModel", label: "Default Fast Model", hint: "Latency-sensitive responses.", capability: "chat" },
  { key: "visionModel", label: "Default Vision Model", hint: "Image understanding tasks.", capability: "vision" },
  {
    key: "embeddingModel",
    label: "Default Embedding Model",
    hint: "Knowledge-base retrieval.",
    capability: "embeddings",
  },
  { key: "imageModel", label: "Default Image Model", hint: "Image generation.", capability: "image" },
  { key: "videoModel", label: "Default Video Model", hint: "Video generation.", capability: "video" },
];

export function AIDefaultsSection({ initialDefaults, models, providers }: Props) {
  const [values, setValues] = useState<AIDefaultsSafe>(initialDefaults);
  const [fallbackProvider, setFallbackProvider] = useState<AIProviderKey | "">(
    (initialDefaults.fallbackProvider as AIProviderKey | null) ?? "",
  );
  const [systemPrompt, setSystemPrompt] = useState(initialDefaults.defaultSystemPrompt ?? "");
  const [platformSystemPrompt, setPlatformSystemPrompt] = useState(initialDefaults.platformSystemPrompt ?? "");
  const [platformSafetyRules, setPlatformSafetyRules] = useState(initialDefaults.platformSafetyRules ?? "");
  const [isPending, startTransition] = useTransition();

  // Candidate models: those enabled and matching the capability (or any enabled model as a fallback).
  const enabledModels = models.filter((m) => m.enabled);
  const candidatesFor = (capability: string) => {
    const exact = enabledModels.filter((m) => m.capabilities.includes(capability as never));
    return exact.length > 0 ? exact : enabledModels;
  };

  function handleSave() {
    startTransition(async () => {
      const result = await saveAIDefaults({
        chatModel: values.chatModel,
        fastModel: values.fastModel,
        visionModel: values.visionModel,
        embeddingModel: values.embeddingModel,
        imageModel: values.imageModel,
        videoModel: values.videoModel,
        fallbackProvider: fallbackProvider || null,
        fallbackModel: values.fallbackModel,
        defaultSystemPrompt: systemPrompt,
        platformSystemPrompt,
        platformSafetyRules,
      });
      if (result.ok) {
        toast.success("AI defaults saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  function setValue(key: DefaultKey, value: string) {
    setValues((prev) => ({ ...prev, [key]: value || null }));
  }

  function modelLabel(m: AIModelSafe) {
    return `${m.name} — ${m.providerName}`;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        {FIELDS.map((field) => {
          const candidates = candidatesFor(field.capability);
          return (
            <div key={field.key} className="space-y-2">
              <div>
                <p className="font-medium text-sm">{field.label}</p>
                <p className="text-muted-foreground text-xs">{field.hint}</p>
              </div>
              <Select value={values[field.key] ?? "none"} onValueChange={(v) => setValue(field.key, v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {candidates.map((m) => (
                    <SelectItem key={m.id} value={m.modelId}>
                      {modelLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}

        <div className="space-y-2">
          <div>
            <p className="font-medium text-sm">Fallback Provider</p>
            <p className="text-muted-foreground text-xs">Used when the primary provider is unavailable.</p>
          </div>
          <Select
            value={fallbackProvider || "none"}
            onValueChange={(v) => setFallbackProvider(v === "none" ? "" : (v as AIProviderKey))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select fallback provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {providers
                .filter((p) => p.enabled)
                .map((p) => (
                  <SelectItem key={p.id} value={p.provider_key}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div>
            <p className="font-medium text-sm">Fallback Model</p>
            <p className="text-muted-foreground text-xs">Model id used by the fallback provider.</p>
          </div>
          <Select value={values.fallbackModel ?? "none"} onValueChange={(v) => setValue("fallbackModel", v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select fallback model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {enabledModels.map((m) => (
                <SelectItem key={m.id} value={m.modelId}>
                  {modelLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2 border-t pt-5">
        <Label htmlFor="platform-system-prompt">Platform System Prompt (Super Admin)</Label>
        <Textarea
          id="platform-system-prompt"
          value={platformSystemPrompt}
          onChange={(e) => setPlatformSystemPrompt(e.target.value)}
          placeholder="You are an AI customer support agent operating on the Sitenex AI platform..."
          className="min-h-32"
        />
        <p className="text-muted-foreground text-xs">
          Immutable platform-level prompt. Super Admin only. This forms the base layer that cannot be overridden by agents.
        </p>
      </div>

      <div className="space-y-2 border-t pt-5">
        <Label htmlFor="platform-safety-rules">Platform Safety Rules (Super Admin)</Label>
        <Textarea
          id="platform-safety-rules"
          value={platformSafetyRules}
          onChange={(e) => setPlatformSafetyRules(e.target.value)}
          placeholder="Never fabricate information. When knowledge is unavailable, clearly state that you don't know..."
          className="min-h-32"
        />
        <p className="text-muted-foreground text-xs">
          Immutable safety/security rules. Super Admin only. These rules always take priority over agent instructions.
        </p>
      </div>

      <div className="space-y-2 border-t pt-5">
        <Label htmlFor="default-system-prompt">Default System Prompt</Label>
        <Textarea
          id="default-system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are an AI assistant for this business..."
          className="min-h-32"
        />
        <p className="text-muted-foreground text-xs">
          Fallback instruction used when an agent has no system prompt of its own. Agents can override this per
          agent.
        </p>
      </div>
    </div>
  );
}
