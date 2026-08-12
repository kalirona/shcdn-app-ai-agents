"use client";

import { useEffect, useState } from "react";

import { Check, Loader2, Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBillingStatus } from "@/lib/auth/actions/billing/billing.actions";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";
import { PLAN_LIMITS, PLAN_PRICES, type PlanName } from "@/lib/auth/schemas/billing.schema";

interface BillingState {
  subscription: {
    plan: PlanName;
    status: string;
    currentPeriodEnd: string | null;
  } | null;
  usage: Record<string, number>;
  limits: Record<string, number>;
}

const PLAN_ORDER: PlanName[] = ["starter", "business", "pro"];
const PLAN_DISPLAY: Record<PlanName, string> = {
  starter: "Starter",
  business: "Business",
  pro: "Pro",
};
const PLAN_TAGLINES: Record<PlanName, string> = {
  starter: "For solo businesses getting started.",
  business: "For growing teams that want real scale.",
  pro: "For high-volume operations.",
};

function UsageMeter({ label, value, limit, unit }: { label: string; value: number; limit: number; unit?: string }) {
  const percentage = limit > 0 ? Math.min((value / limit) * 100, 100) : 0;
  let barColor = "bg-green-500";
  if (percentage > 50) barColor = "bg-yellow-500";
  if (percentage > 80) barColor = "bg-red-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-xs">
          {value.toLocaleString()} / {limit.toLocaleString()}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadBilling = async () => {
      try {
        const user = await getCurrentUser();
        const ws = user.currentWorkspace;
        if (!ws) return;
        const result = await getBillingStatus(ws.id);
        if (!cancelled) {
          if (result.usage && result.limits) {
            const subscription = result.subscription
              ? {
                  plan: (result.subscription.plan ?? "starter") as PlanName,
                  status: result.subscription.status ?? "free",
                  currentPeriodEnd: result.subscription.currentPeriodEnd,
                }
              : null;
            setBilling({
              subscription,
              usage: result.usage,
              limits: result.limits,
            });
          }
        }
      } catch {
        // fall through
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadBilling();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!billing) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground">No workspace selected.</div>;
  }

  const plan = billing.subscription?.plan ?? "starter";
  const status = billing.subscription?.status ?? "free";
  const currentPeriodEnd = billing.subscription?.currentPeriodEnd;
  const renewalLabel = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const contactUrl = `mailto:sales@${
    new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com").hostname
  }?subject=${encodeURIComponent(`Upgrade from ${PLAN_DISPLAY[plan]} plan`)}`;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Manage your plan, usage, and payments.</p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{PLAN_DISPLAY[plan]}</CardTitle>
              <CardDescription>Your current subscription.</CardDescription>
            </div>
            <Badge variant={status === "active" ? "default" : "secondary"}>{status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium text-lg">
              ${PLAN_PRICES[plan].monthly.toLocaleString()}
              <span className="text-muted-foreground text-sm">/month</span>
            </p>
            {renewalLabel ? (
              <p className="text-muted-foreground text-sm">
                {status === "canceled" ? "Cancels at period end" : "Renews"}: {renewalLabel}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">No active billing period.</p>
            )}
          </div>
          <Button asChild>
            <a href={contactUrl}>
              <Mail />
              Manage Subscription
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Usage this month</CardTitle>
          <CardDescription>Your resource usage against plan limits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <UsageMeter
            label="Conversations"
            value={billing.usage.conversations ?? 0}
            limit={billing.limits.conversations ?? 0}
          />
          <UsageMeter
            label="Knowledge storage"
            value={billing.usage.knowledge_storage ?? 0}
            limit={billing.limits.knowledge_storage ?? 0}
            unit="MB"
          />
          <UsageMeter label="Agents" value={billing.usage.agents ?? 0} limit={billing.limits.agents ?? 0} />
          <UsageMeter
            label="AI messages"
            value={billing.usage.ai_messages ?? 0}
            limit={billing.limits.ai_messages ?? 0}
          />
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold text-lg">Plans</h2>
          <p className="text-muted-foreground text-sm">Choose the plan that fits. Upgrades require our team.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Free trial card */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Free Trial</CardTitle>
              <CardDescription>Explore Agent AI with workspace limits.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4">
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-1.5">
                  <Check className="size-4 text-primary" /> Up to 3 conversations
                </p>
                <p className="flex items-center gap-1.5">
                  <Check className="size-4 text-primary" /> 1 active agent
                </p>
              </div>
              <Button asChild variant="outline">
                <a href={contactUrl}>Contact us</a>
              </Button>
            </CardContent>
          </Card>

          {PLAN_ORDER.map((p) => {
            const isCurrent = p === plan;
            return (
              <Card key={p} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{PLAN_DISPLAY[p]}</CardTitle>
                  <CardDescription>{PLAN_TAGLINES[p]}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-lg">
                      ${PLAN_PRICES[p].monthly.toLocaleString()}
                      <span className="text-muted-foreground text-sm">/month</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Check className="size-4 text-primary" /> {PLAN_LIMITS[p].conversations.toLocaleString()}{" "}
                      conversations
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Check className="size-4 text-primary" /> {PLAN_LIMITS[p].agents} agents
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Check className="size-4 text-primary" /> {PLAN_LIMITS[p].knowledge_storage} MB knowledge
                    </p>
                  </div>
                  <Button asChild variant={isCurrent ? "outline" : "default"} disabled={isCurrent}>
                    <a href={contactUrl}>{isCurrent ? "Current Plan" : "Upgrade"}</a>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
