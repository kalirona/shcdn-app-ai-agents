"use client";

import { useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { ArrowLeft, ArrowRight, Bot, Loader2, MessageSquare, Pause, Play, Shield, Target, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAgent } from "@/lib/auth/actions/agent.actions";
import { getUserWorkspaces } from "@/lib/auth/actions/workspace.actions";
import {
  AGENT_BEHAVIOR_DESCRIPTIONS,
  AGENT_BEHAVIOR_LABELS,
  AGENT_BEHAVIORS,
  getToolsForBehaviors,
  TOOL_CATEGORIES,
  TOOL_LABELS,
  TOOLS,
} from "@/lib/auth/agent-config";
import type { AgentEntity } from "@/lib/db/entities";
import { saveAgentToStorage } from "@/lib/db/storage-helper";

async function getFirstWorkspaceId(): Promise<string> {
  try {
    const result = await getUserWorkspaces();
    if (result.success && result.workspaces.length > 0) {
      return result.workspaces[0].id;
    }
  } catch {
    // ignore
  }
  return "workspace-1";
}

const AGENT_PURPOSES = [
  {
    id: "receptionist",
    label: "AI Receptionist",
    icon: Users,
    description: "Greet visitors, answer questions, route to the right person",
    greeting: "Hello! Welcome to our business. How can I help you today?",
  },
  {
    id: "sales",
    label: "AI Sales Assistant",
    icon: Target,
    description: "Qualify leads, present offers, book meetings",
    greeting: "Hi there! I'm here to help you find the perfect solution. What are you looking for?",
  },
  {
    id: "support",
    label: "AI Customer Support",
    icon: MessageSquare,
    description: "Answer questions, troubleshoot issues, create tickets",
    greeting: "Hello! I'm your support assistant. How can I help you today?",
  },
  {
    id: "lead_qualifier",
    label: "AI Lead Qualifier",
    icon: Shield,
    description: "Capture contact info, qualify interest, book demos",
    greeting: "Hi! I'd love to learn more about your needs. Can I ask you a few quick questions?",
  },
  {
    id: "booking",
    label: "AI Booking Assistant",
    icon: Bot,
    description: "Schedule appointments, manage calendar, send reminders",
    greeting: "Hello! I can help you book an appointment. What works best for you?",
  },
  {
    id: "custom",
    label: "Custom",
    icon: Bot,
    description: "Define your own agent personality and goals",
    greeting: "Hello! How can I help you today?",
  },
];

const AGENT_GOALS = [
  {
    id: "generate_leads",
    label: "Generate Qualified Leads",
    description: "Capture contact information and qualify prospects",
  },
  {
    id: "book_appointments",
    label: "Book Appointments",
    description: "Schedule meetings and manage calendar",
  },
  {
    id: "answer_questions",
    label: "Answer Questions",
    description: "Provide accurate answers from your knowledge base",
  },
  {
    id: "qualify_prospects",
    label: "Qualify Prospects",
    description: "Assess fit and route to sales team",
  },
  {
    id: "support_tickets",
    label: "Create Support Tickets",
    description: "Log issues and route to support team",
  },
  {
    id: "collect_feedback",
    label: "Collect Feedback",
    description: "Gather customer satisfaction and feedback",
  },
];

export default function CreateAgentWizard() {
  const router = useRouter();
  const agentIdRef = useRef(`${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("receptionist");
  const [primaryGoal, setPrimaryGoal] = useState("generate_leads");
  const [secondaryGoal, setSecondaryGoal] = useState("answer_questions");
  const [fallbackAction, setFallbackAction] = useState("transfer_human");
  const [greeting, setGreeting] = useState("Hello! How can I help you today?");
  const [fallbackMessage, setFallbackMessage] = useState(
    "I'm not sure about that. Let me connect you with someone who can help.",
  );
  const [instructions, setInstructions] = useState("");
  const [tone, setTone] = useState("professional");
  const [behaviors, setBehaviors] = useState<string[]>([
    AGENT_BEHAVIORS.ANSWER_QUESTIONS,
    AGENT_BEHAVIORS.HUMAN_HANDOFF,
  ]);
  const [error, setError] = useState<string | null>(null);

  const canProceedStep1 = name.trim().length >= 2;
  const canProceedStep2 = true;
  const canProceedStep3 = greeting.trim().length > 0 && fallbackMessage.trim().length > 0;
  const canProceedStep4 = behaviors.length > 0;

  function handlePurposeChange(purposeId: string) {
    setPurpose(purposeId);
    const selectedPurpose = AGENT_PURPOSES.find((p) => p.id === purposeId);
    if (selectedPurpose && purposeId !== "custom") {
      setGreeting(selectedPurpose.greeting);
    }
  }

  function getSystemPrompt(): string {
    const purposeLabel = AGENT_PURPOSES.find((p) => p.id === purpose)?.label ?? "AI Assistant";
    const goalLabel = AGENT_GOALS.find((g) => g.id === primaryGoal)?.label ?? "help customers";
    const secondaryGoalLabel = AGENT_GOALS.find((g) => g.id === secondaryGoal)?.label ?? "";

    const prompt = `You are ${name}, an AI ${purposeLabel} for this business.

## Your Identity
- Name: ${name}
- Role: ${purposeLabel}
- Tone: ${tone}

## Primary Goal
${goalLabel}
${secondaryGoalLabel ? `## Secondary Goal\n${secondaryGoalLabel}` : ""}

## Fallback Action
When you cannot help: ${
      fallbackAction === "transfer_human"
        ? "Politely offer to connect with a human team member."
        : fallbackAction === "create_ticket"
          ? "Create a support ticket for follow-up."
          : "Capture their contact information for follow-up."
    }

## Rules
- Always be helpful, concise, and professional.
- Stay in character as a ${purposeLabel}.
- NEVER make up information or policies not in your knowledge base.
- If you don't know, say so honestly.
- Keep responses under 3 sentences unless more detail is needed.
- Always work toward your primary goal: ${goalLabel}.
${fallbackAction === "transfer_human" ? "- If the customer asks for a human, offer to transfer." : ""}
${fallbackAction === "collect_info" ? "- Capture their name and email for follow-up." : ""}

${instructions ? `## Custom Instructions\n${instructions}` : ""}`;

    return prompt;
  }

  async function handleSubmit() {
    if (!name.trim() || !greeting.trim() || !fallbackMessage.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const workspaceId = await getFirstWorkspaceId();

      const result = await createAgent(workspaceId, {
        name: name.trim(),
        description: AGENT_PURPOSES.find((p) => p.id === purpose)?.label ?? "",
        tone: tone as "professional" | "friendly" | "casual" | "custom",
        greeting: greeting.trim(),
        fallbackMessage: fallbackMessage.trim(),
        language: "en",
        systemInstructions: instructions.trim(),
        purpose,
        primaryGoal,
        secondaryGoal,
        fallbackAction,
        behaviors,
        allowedTools: getToolsForBehaviors(behaviors as any),
      });

      if (result.agent) {
        saveAgentToStorage(result.agent as AgentEntity);
        toast.success("Agent created successfully!");
        router.push(`/dashboard/agents/${result.agent.id}/overview`);
        return;
      }

      if (result.error) {
        console.error("Failed to create agent in DB:", result.error);
      }

      const fallbackAgent: AgentEntity = {
        id: agentIdRef.current,
        workspace: workspaceId,
        name: name.trim(),
        description: AGENT_PURPOSES.find((p) => p.id === purpose)?.label || null,
        avatar: null,
        system_prompt: instructions.trim() || getSystemPrompt(),
        tone: tone as "professional" | "friendly" | "casual" | "custom",
        language: "en",
        greeting: greeting.trim(),
        fallback_message: fallbackMessage.trim(),
        status: "active",
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
        purpose,
        primary_goal: primaryGoal,
        secondary_goal: secondaryGoal,
        fallback_action: fallbackAction,
        behaviors,
        allowed_tools: getToolsForBehaviors(behaviors as any),
      };

      saveAgentToStorage(fallbackAgent);
      toast.success("Agent created successfully!");
      router.push(`/dashboard/agents/${agentIdRef.current}/overview`);
    } catch {
      setError("Failed to create agent. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft />
          Back
        </Button>
        <h1 className="font-semibold text-2xl tracking-tight">Create AI Agent</h1>
        <p className="text-muted-foreground">
          Step {step} of 4 —{" "}
          {step === 1
            ? "What should it do?"
            : step === 2
              ? "Goals & behavior"
              : step === 3
                ? "Capabilities & tools"
                : "Review & publish"}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Identity */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot />
              What should your AI agent do?
            </CardTitle>
            <CardDescription>Choose a purpose for your agent. You can customize everything later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent name *</Label>
              <Input
                id="agent-name"
                placeholder="e.g. Sarah, Mike, Support Bot"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                maxLength={64}
              />
            </div>
            <div className="space-y-2">
              <Label>Agent purpose *</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {AGENT_PURPOSES.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePurposeChange(p.id)}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                        purpose === p.id ? "border-primary bg-primary/5 shadow-sm" : "hover:border-muted-foreground/50"
                      }`}
                    >
                      <Icon className={`size-6 ${purpose === p.id ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-medium text-sm">{p.label}</span>
                      <span className="text-muted-foreground text-xs">{p.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                Next
                <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Goals & Behavior */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target />
              Goals & behavior
            </CardTitle>
            <CardDescription>Define what your AI agent should achieve.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Primary Goal *</Label>
              <div className="grid gap-2">
                {AGENT_GOALS.map((goal) => (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => setPrimaryGoal(goal.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                      primaryGoal === goal.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
                    }`}
                  >
                    <Target
                      className={`size-4 shrink-0 ${primaryGoal === goal.id ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <div>
                      <p className="font-medium text-sm">{goal.label}</p>
                      <p className="text-muted-foreground text-xs">{goal.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secondary Goal (optional)</Label>
              <div className="grid gap-2">
                {AGENT_GOALS.filter((g) => g.id !== primaryGoal).map((goal) => (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => setSecondaryGoal(goal.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                      secondaryGoal === goal.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
                    }`}
                  >
                    <Play
                      className={`size-4 shrink-0 ${secondaryGoal === goal.id ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <div>
                      <p className="font-medium text-sm">{goal.label}</p>
                      <p className="text-muted-foreground text-xs">{goal.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>When AI can't help (fallback) *</Label>
              <div className="grid gap-2">
                {[
                  { id: "transfer_human", label: "Transfer to human", desc: "Connect customer with a team member" },
                  { id: "create_ticket", label: "Create support ticket", desc: "Log issue for follow-up" },
                  { id: "collect_info", label: "Collect contact info", desc: "Capture email for follow-up" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFallbackAction(opt.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                      fallbackAction === opt.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
                    }`}
                  >
                    <Pause
                      className={`size-4 shrink-0 ${fallbackAction === opt.id ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <div>
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-muted-foreground text-xs">{opt.desc}</p>
                    </div>
                  </button>
                ))}
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-instructions">Custom instructions (optional)</Label>
              <Textarea
                id="agent-instructions"
                placeholder="e.g. Always mention our 30-day money-back guarantee when discussing pricing..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                disabled={isLoading}
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} disabled={isLoading}>
                <ArrowLeft />
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep3}>
                Next
                <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Capabilities & Tools */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Capabilities & tools</CardTitle>
            <CardDescription>
              Choose what your AI agent can do. This controls which tools it can access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Agent capabilities *</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.values(AGENT_BEHAVIORS).map((behavior) => {
                  const isEnabled = behaviors.includes(behavior);
                  return (
                    <button
                      key={behavior}
                      type="button"
                      onClick={() => {
                        if (isEnabled) {
                          setBehaviors(behaviors.filter((b) => b !== behavior));
                        } else {
                          setBehaviors([...behaviors, behavior]);
                        }
                      }}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                        isEnabled ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
                      }`}
                    >
                      <div
                        className={`flex size-5 shrink-0 items-center justify-center rounded border ${isEnabled ? "border-primary bg-primary" : "border-muted-foreground"}`}
                      >
                        {isEnabled && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {AGENT_BEHAVIOR_LABELS[behavior as keyof typeof AGENT_BEHAVIOR_LABELS]}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {AGENT_BEHAVIOR_DESCRIPTIONS[behavior as keyof typeof AGENT_BEHAVIOR_DESCRIPTIONS]}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {behaviors.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-sm font-medium">Enabled tools:</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {getToolsForBehaviors(behaviors as any).map((tool) => (
                    <span key={tool} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                      {TOOL_LABELS[tool as keyof typeof TOOL_LABELS]}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} disabled={isLoading}>
                <ArrowLeft />
                Back
              </Button>
              <Button onClick={() => setStep(4)} disabled={!canProceedStep4}>
                Next
                <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Publish */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & publish</CardTitle>
            <CardDescription>Review your agent settings and activate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Bot className="size-5 text-primary" />
                <span className="font-medium">{name}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                  {AGENT_PURPOSES.find((p) => p.id === purpose)?.label}
                </span>
              </div>
              <div className="grid gap-2 text-sm">
                <p>
                  <strong>Primary Goal:</strong> {AGENT_GOALS.find((g) => g.id === primaryGoal)?.label}
                </p>
                <p>
                  <strong>Fallback:</strong>{" "}
                  {fallbackAction === "transfer_human"
                    ? "Transfer to human"
                    : fallbackAction === "create_ticket"
                      ? "Create ticket"
                      : "Collect info"}
                </p>
                <p>
                  <strong>Greeting:</strong> {greeting}
                </p>
                <p>
                  <strong>Capabilities:</strong>{" "}
                  {behaviors.map((b) => AGENT_BEHAVIOR_LABELS[b as keyof typeof AGENT_BEHAVIOR_LABELS]).join(", ")}
                </p>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)} disabled={isLoading}>
                <ArrowLeft />
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={!canProceedStep4 || isLoading}>
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
