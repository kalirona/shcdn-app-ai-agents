"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bot, Loader2, MessageSquare, Palette, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AgentEntity } from "@/lib/db/entities";
import { saveAgentToStorage } from "@/lib/db/storage-helper";

const TONE_OPTIONS = [
  { value: "professional", label: "Professional", icon: Shield, description: "Formal and business-like" },
  { value: "friendly", label: "Friendly", icon: MessageSquare, description: "Warm and approachable" },
  { value: "casual", label: "Casual", icon: Palette, description: "Relaxed and conversational" },
];

export default function CreateAgentWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("professional");
  const [greeting, setGreeting] = useState("Hello! How can I help you today?");
  const [fallbackMessage, setFallbackMessage] = useState(
    "I'm not sure about that. Let me connect you with someone who can help.",
  );
  const [systemInstructions, setSystemInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canProceedStep1 = name.trim().length >= 2;
  const canProceedStep2 = greeting.trim().length > 0 && fallbackMessage.trim().length > 0;

  function handleSubmit() {
    if (!name.trim() || !greeting.trim() || !fallbackMessage.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const agent: AgentEntity = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        workspace: "workspace-1",
        name: name.trim(),
        description: description.trim() || null,
        avatar: null,
        system_prompt: systemInstructions.trim() || defaultSystemPrompt(name.trim(), tone),
        tone: tone as "professional" | "friendly" | "casual" | "custom",
        language: "en",
        greeting: greeting.trim(),
        fallback_message: fallbackMessage.trim(),
        status: "draft",
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
      };

      saveAgentToStorage(agent);

      toast.success("Agent created successfully!");
      router.push(`/dashboard/agents/${agent.id}/overview`);
    } catch {
      setError("Failed to create agent. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft />
          Back
        </Button>
        <h1 className="font-semibold text-2xl tracking-tight">Create AI Agent</h1>
        <p className="text-muted-foreground">
          Step {step} of 2 — {step === 1 ? "Basic information" : "Personality & behavior"}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
          {error}
        </div>
      )}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot />
              Step 1 — Business AI
            </CardTitle>
            <CardDescription>Tell us about your agent and what it represents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent name *</Label>
              <Input
                id="agent-name"
                placeholder="e.g. Support Bot, Sales Assistant"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                maxLength={64}
              />
              <p className="text-muted-foreground text-xs">This name will be shown to customers in the chat widget.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-description">Description (optional)</Label>
              <Textarea
                id="agent-description"
                placeholder="A brief description of what this agent does..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                Next
                <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette />
              Step 2 — Personality & Behavior
            </CardTitle>
            <CardDescription>Configure how your agent communicates with customers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Conversation tone *</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {TONE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTone(option.value)}
                      className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors ${
                        tone === option.value ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
                      }`}
                    >
                      <Icon className={`size-6 ${tone === option.value ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-medium text-sm">{option.label}</span>
                      <span className="text-muted-foreground text-xs">{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-greeting">Greeting message *</Label>
              <Input
                id="agent-greeting"
                placeholder="Hello! How can I help you today?"
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                disabled={isLoading}
                maxLength={200}
              />
              <p className="text-muted-foreground text-xs">The first message customers see when they open the chat.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-fallback">Fallback message *</Label>
              <Input
                id="agent-fallback"
                placeholder="I'm not sure about that. Let me connect you with someone who can help."
                value={fallbackMessage}
                onChange={(e) => setFallbackMessage(e.target.value)}
                disabled={isLoading}
                maxLength={500}
              />
              <p className="text-muted-foreground text-xs">Shown when the agent can&apos;t answer a question.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-instructions">System instructions (optional)</Label>
              <Textarea
                id="agent-instructions"
                placeholder="Custom instructions for the AI about how to behave..."
                value={systemInstructions}
                onChange={(e) => setSystemInstructions(e.target.value)}
                disabled={isLoading}
                rows={4}
                maxLength={2000}
              />
              <p className="text-muted-foreground text-xs">
                Advanced: Override the default system prompt for this agent.
              </p>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} disabled={isLoading}>
                <ArrowLeft />
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={!canProceedStep2 || isLoading}>
                {isLoading && <Loader2 className="size-4 animate-spin" />}
                Create Agent
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function defaultSystemPrompt(name: string, tone: string): string {
  const toneMap: Record<string, string> = {
    professional: "You are a professional and courteous assistant.",
    friendly: "You are a warm and friendly assistant who makes everyone feel welcome.",
    casual: "You are a casual and relaxed assistant.",
    custom: "You are a helpful assistant.",
  };

  return `${toneMap[tone] ?? toneMap.professional}

Your name is ${name}. You help customers by answering questions about the business.

Rules:
- Always be helpful and concise.
- If you don't know the answer, say so honestly and offer to connect them with a human.
- Never make up information or policies.
- If a customer seems frustrated or asks for a human, offer to escalate.
- Keep responses under 3 sentences unless more detail is needed.`;
}
