"use client";

import { useEffect, useState } from "react";

import { ArrowRight, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBillingStatus } from "@/lib/auth/actions/billing/billing.actions";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";
import { PLAN_DISPLAY, type PlanName } from "@/lib/auth/schemas/billing.schema";

export function BillingTab() {
  const [plan, setPlan] = useState<PlanName | "free" | null>(null);
  const [status, setStatus] = useState("free");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const user = await getCurrentUser();
        const ws = user.currentWorkspace;
        if (!ws) return;
        const result = await getBillingStatus(ws.id);
        if (!cancelled && result.subscription) {
          setPlan(
            result.subscription.status === "free" || result.subscription.status === "trialing"
              ? "free"
              : (result.subscription.plan ?? "starter"),
          );
          setStatus(result.subscription.status ?? "free");
        }
      } catch {
        // fall through
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Subscription</h3>
          <p className="text-muted-foreground text-sm">Your workspace billing status.</p>
        </div>
        <a href="/dashboard/settings/billing" className="text-primary text-sm hover:underline">
          Open billing →
        </a>
      </div>
      <div className="rounded-lg border bg-background p-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading plan…
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{plan ? PLAN_DISPLAY[plan] : "Free"}</p>
                <Badge variant={status === "active" ? "default" : "secondary"}>{status}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">Manage your plan, usage, and payments.</p>
            </div>
            <Button asChild size="sm">
              <a href="/dashboard/settings/billing">
                Manage billing
                <ArrowRight />
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
