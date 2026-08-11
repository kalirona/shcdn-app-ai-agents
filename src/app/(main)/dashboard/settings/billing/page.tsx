"use client";

import { useEffect, useState } from "react";

import { Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBillingStatus } from "@/lib/auth/actions/billing/billing.actions";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";
import { PLAN_LIMITS } from "@/lib/auth/schemas/billing.schema";

export default function BillingPage() {
  const [billingStatus, setBillingStatus] = useState<{
    subscription: unknown;
    usage: Record<string, number>;
    limits: Record<string, number>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadBilling = async () => {
      try {
        const user = await getCurrentUser();
        const ws = user.currentWorkspace;
        if (!ws) {
          return;
        }
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
        <p className="text-muted-foreground">Your workspace is currently on the free trial.</p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Free Trial</CardTitle>
          <CardDescription>Your workspace is on the free trial.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            You&apos;re currently on the free trial. To upgrade to a paid plan, get in touch with our team and
            we&apos;ll get you set up.
          </p>
          <Button asChild>
            <a
              href={`mailto:sales@${new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com").hostname}?subject=${encodeURIComponent("Upgrade to a paid plan")}`}
            >
              <Mail />
              Contact us to upgrade
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Usage Overview */}
      {billingStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Current Usage</CardTitle>
            <CardDescription>Your usage during the free trial period.</CardDescription>
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
    </div>
  );
}
