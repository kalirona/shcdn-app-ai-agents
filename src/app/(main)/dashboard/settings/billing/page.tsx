"use client";

import { useEffect, useState } from "react";

import { Check, CreditCard, Loader2, Shield, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cancelSubscription,
  createCheckoutSession,
  getBillingStatus,
} from "@/lib/auth/actions/billing/billing.actions";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";
import { PLAN_LIMITS } from "@/lib/auth/schemas/billing.schema";

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: 29,
    description: "For small businesses getting started",
    features: ["1 AI Agent", "1,000 conversations/mo", "50MB knowledge storage", "Lead capture", "Booking system"],
  },
  {
    id: "business" as const,
    name: "Business",
    price: 79,
    description: "For growing businesses",
    features: [
      "5 AI Agents",
      "5,000 conversations/mo",
      "500MB knowledge storage",
      "Analytics dashboard",
      "Human handoff",
      "Team members (5)",
    ],
    popular: true,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: 149,
    description: "For agencies and enterprises",
    features: [
      "15 AI Agents",
      "20,000 conversations/mo",
      "2GB knowledge storage",
      "Advanced analytics",
      "White-label widget",
      "Team members (20)",
      "Priority support",
    ],
  },
];

const PAYMENT_PROVIDERS = [
  { id: "stripe" as const, name: "Credit Card (Stripe)", icon: CreditCard },
  { id: "paypal" as const, name: "PayPal", icon: Shield },
  { id: "lemon_squeezy" as const, name: "Lemon Squeezy", icon: Zap },
];

export default function BillingPage() {
  const [billingStatus, setBillingStatus] = useState<{
    subscription: unknown;
    usage: Record<string, number>;
    limits: Record<string, number>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<"stripe" | "paypal" | "lemon_squeezy">("stripe");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadBilling = async () => {
      try {
        const user = await getCurrentUser();
        const ws = user.currentWorkspace;
        if (!ws) {
          return;
        }
        setWorkspaceId(ws.id);
        const result = await getBillingStatus(ws.id);
        if (!cancelled && result.usage && result.limits) {
          setBillingStatus({
            subscription: result.subscription,
            usage: result.usage,
            limits: result.limits,
          });
        } else if (!cancelled) {
          setBillingStatus({
            subscription: null,
            usage: {
              ai_messages: 0,
              ai_tokens: 0,
              conversations: 0,
              agents: 0,
              knowledge_storage: 0,
              documents: 0,
              team_members: 1,
              bookings: 0,
            },
            limits: PLAN_LIMITS.starter,
          });
        }
      } catch {
        if (!cancelled) {
          setBillingStatus({
            subscription: null,
            usage: {
              ai_messages: 0,
              ai_tokens: 0,
              conversations: 0,
              agents: 0,
              knowledge_storage: 0,
              documents: 0,
              team_members: 1,
              bookings: 0,
            },
            limits: PLAN_LIMITS.starter,
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadBilling();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubscribe(planId: "starter" | "business" | "pro") {
    if (!workspaceId) {
      toast.error("No active workspace.");
      return;
    }
    const result = await createCheckoutSession(planId, selectedProvider);
    if (result.error) {
      toast.error(result.error);
    } else if (result.url) {
      window.location.href = result.url;
    }
  }

  async function handleCancel() {
    if (!workspaceId) {
      toast.error("No active workspace.");
      return;
    }
    const result = await cancelSubscription(workspaceId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Subscription will cancel at end of billing period.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Billing & Plans</h1>
        <p className="text-muted-foreground">Manage your subscription and payment methods.</p>
      </div>

      {/* Usage Overview */}
      {billingStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Current Usage</CardTitle>
            <CardDescription>Your usage for the current billing period.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(billingStatus.usage).map(([key, value]) => {
                const limit = (billingStatus.limits as Record<string, number>)[key] ?? 0;
                const percentage = limit > 0 ? Math.min((value / limit) * 100, 100) : 0;
                let barColor = "bg-green-500";
                if (percentage > 50) {
                  barColor = "bg-yellow-500";
                }
                if (percentage > 80) {
                  barColor = "bg-red-500";
                }
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                      <span className="text-xs">
                        {value}/{limit}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>Choose your preferred payment provider.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {PAYMENT_PROVIDERS.map((provider) => {
              const Icon = provider.icon;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedProvider(provider.id)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                    selectedProvider === provider.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-muted-foreground/50"
                  }`}
                >
                  <Icon className="size-4" />
                  {provider.name}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.id} className={plan.popular ? "relative border-primary ring-1 ring-primary" : ""}>
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-primary-foreground text-xs">
                Most Popular
              </span>
            )}
            <CardHeader className="pb-4">
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-2">
                <span className="font-bold text-3xl">${plan.price}</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="size-4 shrink-0 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.popular ? "default" : "outline"}
                onClick={() => handleSubscribe(plan.id)}
              >
                Subscribe
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cancel Subscription */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Cancel your subscription at end of billing period.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleCancel}>
            Cancel Subscription
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
