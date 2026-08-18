"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useSearchParams } from "next/navigation";

import { Check, CreditCard, Loader2, Mail, ReceiptText } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cancelSubscription,
  createCheckoutSession,
  getBillingAccess,
  getBillingStatus,
  resumeSubscription,
} from "@/lib/auth/actions/billing/billing.actions";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";
import {
  PLAN_DISPLAY,
  PLAN_LIMITS,
  PLAN_ORDER,
  PLAN_PRICES,
  PLAN_TAGLINES,
  type PlanName,
  type PlanTier,
} from "@/lib/auth/schemas/billing.schema";

interface BillingState {
  subscription: {
    plan: PlanName;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    paymentProvider: string | null;
  } | null;
  usage: Record<string, number>;
  limits: Record<string, number>;
}

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

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-sm">
      <Check className="size-4 shrink-0 text-primary" />
      {children}
    </p>
  );
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [billingEmail, setBillingEmail] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [canManageBilling, setCanManageBilling] = useState(false);
  const [paypalReturn, setPaypalReturn] = useState<"success" | "cancelled" | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const paypal = searchParams.get("paypal");
    if (paypal === "success") setPaypalReturn("success");
    if (paypal === "cancelled") setPaypalReturn("cancelled");
  }, [searchParams]);

  const loadBilling = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      const ws = user.currentWorkspace;
      if (!ws) return;
      setWorkspaceId(ws.id);
      setBillingEmail(user.user.email);
      const access = await getBillingAccess(ws.id);
      setCanManageBilling(access.canManageBilling);
      const result = await getBillingStatus(ws.id);
      if (result.usage && result.limits) {
        const subscription = result.subscription
          ? {
              plan: (result.subscription.plan ?? "starter") as PlanName,
              status: result.subscription.status ?? "free",
              currentPeriodEnd: result.subscription.currentPeriodEnd,
              cancelAtPeriodEnd: result.subscription.cancelAtPeriodEnd ?? false,
              paymentProvider: result.subscription.paymentProvider,
            }
          : null;
        setBilling({
          subscription,
          usage: result.usage,
          limits: result.limits,
        });
      }
    } catch {
      // fall through
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await loadBilling();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [loadBilling]);

  const currentTier: PlanTier = useMemo(() => {
    if (!billing?.subscription) return "free";
    const status = billing.subscription.status;
    if (status === "free" || status === "trialing") return "free";
    return billing.subscription.plan;
  }, [billing]);

  const isCanceled = billing?.subscription?.status === "canceled";
  const renewsLabel = useMemo(() => {
    if (!billing?.subscription?.currentPeriodEnd) return null;
    return new Date(billing.subscription.currentPeriodEnd).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [billing]);

  const contactUrl = `mailto:sales@${
    new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com").hostname
  }?subject=${encodeURIComponent(`Subscription for ${PLAN_DISPLAY[currentTier]}`)}`;

  async function runAction(key: string, fn: () => Promise<{ success?: boolean; error?: string }>) {
    if (!workspaceId) return;
    setPendingAction(key);
    try {
      const result = await fn();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Subscription updated.");
        await loadBilling();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  function handleResume() {
    void runAction("resume", () => resumeSubscription(workspaceId!));
  }

  async function handlePayPalCheckout(plan: PlanTier) {
    if (plan === "free" || !workspaceId) return;
    try {
      const result = await createCheckoutSession(plan as PlanName, "paypal");
      if ("error" in result) {
        if (result.error === "PAYPAL_NOT_CONFIGURED") {
          toast.error("PayPal isn't configured yet. Please contact support.");
        } else {
          toast.error(result.error);
        }
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      toast.error("Something went wrong starting checkout. Please try again.");
    }
  }

  function isCurrentTier(tier: PlanTier) {
    return currentTier === tier;
  }

  function tierButtonLabel(tier: PlanTier) {
    if (isCurrentTier(tier)) return "Current plan";
    if (tier === "free") return "Cancel plan";
    return "Switch to this plan";
  }

  const isPayPalPending =
    billing?.subscription?.paymentProvider === "paypal" && billing.subscription.status !== "active";

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

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Manage your plan, usage, and payments.</p>
      </div>

      {paypalReturn === "success" && (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Payment received. We&apos;re confirming your subscription.</p>
          <p className="text-muted-foreground mt-1">
            Your plan becomes active as soon as PayPal confirms the subscription. This page will refresh to show the
            updated status.
          </p>
        </div>
      )}
      {paypalReturn === "cancelled" && (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Checkout cancelled.</p>
          <p className="text-muted-foreground mt-1">No changes were made to your subscription.</p>
        </div>
      )}

      {isPayPalPending && (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Payment received. We&apos;re confirming your subscription.</p>
          <p className="text-muted-foreground mt-1">
            Your plan becomes active once PayPal confirms the subscription. If it takes more than a few minutes, contact
            support.
          </p>
        </div>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{PLAN_DISPLAY[currentTier]}</CardTitle>
              <CardDescription>Your current subscription.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {billing.subscription?.paymentProvider === "paypal" && <Badge variant="outline">PayPal</Badge>}
              <Badge variant={isCanceled ? "secondary" : "default"}>{billing.subscription?.status ?? "free"}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-lg">
                {currentTier === "free" ? (
                  "$0"
                ) : (
                  <>
                    ${PLAN_PRICES[currentTier as PlanName].monthly.toLocaleString()}
                    <span className="text-muted-foreground text-sm">/month</span>
                  </>
                )}
              </p>
              {renewsLabel ? (
                <p className="text-muted-foreground text-sm">
                  {isCanceled || billing.subscription?.cancelAtPeriodEnd ? "Cancels at period end" : "Renews"}:{" "}
                  {renewsLabel}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {currentTier === "free" ? "Free plan — no billing period." : "No active billing period."}
                </p>
              )}
            </div>
            <Button asChild variant="outline">
              <a href={contactUrl}>
                <Mail />
                Manage Subscription
              </a>
            </Button>
          </div>

          {currentTier !== "free" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-muted-foreground text-xs">Conversations</p>
                <p className="font-medium">{billing.limits.conversations?.toLocaleString()} / month</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-muted-foreground text-xs">Agents</p>
                <p className="font-medium">{billing.limits.agents} active</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-muted-foreground text-xs">Knowledge storage</p>
                <p className="font-medium">{billing.limits.knowledge_storage} MB</p>
              </div>
            </div>
          )}
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
          <p className="text-muted-foreground text-sm">
            Switching plans applies immediately to your workspace limits. Changing the plan you pay for is arranged by
            our team.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((tier) => {
            const isCurrent = isCurrentTier(tier);
            const limits = tier === "free" ? null : PLAN_LIMITS[tier as PlanName];
            const price = tier === "free" ? null : PLAN_PRICES[tier as PlanName];
            const label = tierButtonLabel(tier);
            const key = `plan:${tier}`;
            const isPending = pendingAction === key || pendingAction === `cancel:${tier}`;

            return (
              <Card key={tier} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{PLAN_DISPLAY[tier]}</CardTitle>
                  <CardDescription>{PLAN_TAGLINES[tier]}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div className="space-y-2">
                    {price ? (
                      <p className="font-medium text-lg">
                        ${price.monthly.toLocaleString()}
                        <span className="text-muted-foreground text-sm">/month</span>
                      </p>
                    ) : (
                      <p className="font-medium text-lg">$0</p>
                    )}
                    {limits ? (
                      <>
                        <PlanFeature>{limits.conversations.toLocaleString()} conversations / month</PlanFeature>
                        <PlanFeature>{limits.agents} agents</PlanFeature>
                        <PlanFeature>{limits.knowledge_storage} MB knowledge</PlanFeature>
                      </>
                    ) : (
                      <>
                        <PlanFeature>3 conversations</PlanFeature>
                        <PlanFeature>1 active agent</PlanFeature>
                        <PlanFeature>Limited knowledge storage</PlanFeature>
                      </>
                    )}
                  </div>

                  {isCurrent || !canManageBilling ? (
                    <Button variant="outline" disabled>
                      {isCurrent ? "Current plan" : "Owner only"}
                    </Button>
                  ) : tier === "free" ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" disabled={isCanceled || isPending}>
                          {isPending ? <Loader2 className="size-4 animate-spin" /> : label}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You&apos;ll move to the free plan when your current period ends. Your workspace and data
                            stay intact.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep my plan</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={isPending}
                            onClick={(e) => {
                              e.preventDefault();
                              void runAction(`cancel:${tier}`, () => cancelSubscription(workspaceId!));
                            }}
                          >
                            {isPending && <Loader2 className="size-4 animate-spin" />}
                            Cancel plan
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button disabled={isPending} onClick={() => void handlePayPalCheckout(tier)}>
                      {isPending ? <Loader2 className="size-4 animate-spin" /> : "Upgrade"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment & subscription actions */}
      <Card>
        <CardHeader>
          <CardTitle>Payment &amp; subscription</CardTitle>
          <CardDescription>Your billing details and subscription controls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CreditCard className="size-4" />
                <p className="text-sm font-medium">Payment method</p>
              </div>
              <p className="mt-2 text-sm">
                No payment method on file yet.{" "}
                <span className="text-muted-foreground">
                  We handle billing over email until online payments are enabled.
                </span>
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <a href={contactUrl}>Set up billing</a>
              </Button>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-4" />
                <p className="text-sm font-medium">Billing email</p>
              </div>
              <p className="mt-2 text-sm">{billingEmail || "Not set"}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ReceiptText className="size-4" />
                <p className="text-sm font-medium">Invoices</p>
              </div>
              <p className="mt-2 text-muted-foreground text-sm">
                No invoices yet. Invoices appear here once you start a paid subscription.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ReceiptText className="size-4" />
                <p className="text-sm font-medium">Payment history</p>
              </div>
              <p className="mt-2 text-muted-foreground text-sm">
                No payments yet. Your payment history will show here after your first charge.
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="font-medium text-sm">Subscription actions</p>
            {!canManageBilling ? (
              <p className="text-muted-foreground mt-3 text-sm">
                Only the workspace owner can change, cancel, or resume the subscription.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {!isCanceled && currentTier !== "pro" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingAction === "upgrade"}
                    onClick={() => {
                      const next: PlanTier =
                        currentTier === "free" ? "starter" : currentTier === "starter" ? "business" : "pro";
                      void handlePayPalCheckout(next as PlanName);
                    }}
                  >
                    {pendingAction === "upgrade" && <Loader2 className="size-4 animate-spin" />}
                    Upgrade
                  </Button>
                )}
                {!isCanceled && currentTier !== "free" && currentTier !== "starter" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingAction === "downgrade"}
                    onClick={() => {
                      const lower: PlanTier = currentTier === "pro" ? "business" : "starter";
                      void handlePayPalCheckout(lower as PlanName);
                    }}
                  >
                    {pendingAction === "downgrade" && <Loader2 className="size-4 animate-spin" />}
                    Downgrade
                  </Button>
                )}
                {!isCanceled && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Cancel
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                        <AlertDialogDescription>
                          You&apos;ll keep access until the end of your current billing period, then move to the free
                          plan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep my plan</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={pendingAction === "cancel"}
                          onClick={(e) => {
                            e.preventDefault();
                            void runAction("cancel", () => cancelSubscription(workspaceId!));
                          }}
                        >
                          {pendingAction === "cancel" && <Loader2 className="size-4 animate-spin" />}
                          Cancel plan
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {isCanceled && (
                  <Button variant="outline" size="sm" disabled={pendingAction === "resume"} onClick={handleResume}>
                    {pendingAction === "resume" && <Loader2 className="size-4 animate-spin" />}
                    Resume
                  </Button>
                )}
                <Button asChild variant="outline" size="sm">
                  <a href={contactUrl}>Manage subscription</a>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
