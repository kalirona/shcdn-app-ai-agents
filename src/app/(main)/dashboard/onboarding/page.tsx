"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Building2,
  Check,
  Globe,
  MessageSquare,
  Palette,
  Rocket,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEPS = [
  { id: 1, title: "Welcome", subtitle: "Let's set up your account" },
  { id: 2, title: "Business Info", subtitle: "Tell us about your business" },
  { id: 3, title: "First Agent", subtitle: "Create your first AI agent" },
  { id: 4, title: "Done", subtitle: "You're ready to go!" },
];

const BUSINESS_TYPES = [
  { id: "saas", label: "SaaS / Software", icon: Palette },
  { id: "ecommerce", label: "E-commerce", icon: Globe },
  { id: "service", label: "Service Business", icon: Users },
  { id: "agency", label: "Agency", icon: Building2 },
  { id: "other", label: "Other", icon: MessageSquare },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [website, setWebsite] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentTone, setAgentTone] = useState("professional");

  function handleComplete() {
    toast.success("Setup complete! Welcome to Agent AI.");
    router.push("/dashboard");
  }

  function nextStep() {
    if (step < 4) setStep(step + 1);
    else handleComplete();
  }

  function prevStep() {
    if (step > 1) setStep(step - 1);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-8 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${
                step >= s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step > s.id ? <Check className="size-4" /> : s.id}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 h-0.5 w-12 sm:w-20 ${step > s.id ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{STEPS[step - 1].title}</CardTitle>
            <CardDescription>{STEPS[step - 1].subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 1: Welcome */}
            {step === 1 && (
              <div className="space-y-6 py-4 text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
                  <Rocket className="size-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Welcome to Agent AI!</h3>
                  <p className="mt-2 text-muted-foreground text-sm">
                    Let&apos;s get you set up in just a few minutes. We&apos;ll help you create your first AI agent.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Business Info */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="business-name">Business name</Label>
                  <Input
                    id="business-name"
                    placeholder="Acme Inc."
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>What type of business?</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {BUSINESS_TYPES.map((type) => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setBusinessType(type.id)}
                          className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-center text-sm transition-colors ${
                            businessType === type.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
                          }`}
                        >
                          <Icon className="size-5" />
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website (optional)</Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://example.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 3: First Agent */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agent-name">Agent name</Label>
                  <Input
                    id="agent-name"
                    placeholder="e.g. Support Bot"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">This name will be shown to customers in the chat widget.</p>
                </div>
                <div className="space-y-2">
                  <Label>Conversation tone</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "professional", label: "Professional" },
                      { id: "friendly", label: "Friendly" },
                      { id: "casual", label: "Casual" },
                    ].map((tone) => (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => setAgentTone(tone.id)}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                          agentTone === tone.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
                        }`}
                      >
                        {tone.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Done */}
            {step === 4 && (
              <div className="space-y-6 py-4 text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100">
                  <Check className="size-8 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">You&apos;re all set!</h3>
                  <p className="mt-2 text-muted-foreground text-sm">
                    Your workspace is ready. Go to your dashboard to create AI agents and start engaging customers.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={prevStep} disabled={step === 1}>
                Back
              </Button>
              <Button onClick={nextStep}>
                {step === 4 ? "Go to Dashboard" : "Continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
