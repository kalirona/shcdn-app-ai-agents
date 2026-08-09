"use client";

export function BillingTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Subscription</h3>
          <p className="text-muted-foreground text-sm">Manage your plan and payment methods.</p>
        </div>
        <a href="/dashboard/settings/billing" className="text-primary text-sm hover:underline">
          Manage billing →
        </a>
      </div>
      <div className="rounded-lg border bg-background p-6">
        <p className="text-muted-foreground text-sm">
          You are currently on the <strong>free trial</strong>. Upgrade to unlock all features.
        </p>
        <a
          href="/dashboard/settings/billing"
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm"
        >
          View Plans
        </a>
      </div>
    </div>
  );
}
