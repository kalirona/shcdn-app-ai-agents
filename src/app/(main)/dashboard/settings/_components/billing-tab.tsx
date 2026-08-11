"use client";

export function BillingTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Subscription</h3>
          <p className="text-muted-foreground text-sm">Your workspace billing status.</p>
        </div>
        <a href="/dashboard/settings/billing" className="text-primary text-sm hover:underline">
          Manage billing →
        </a>
      </div>
      <div className="rounded-lg border bg-background p-6">
        <p className="text-muted-foreground text-sm">
          You&apos;re currently on the <strong>free trial</strong>.
        </p>
        <a
          href={`mailto:sales@${new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com").hostname}?subject=${encodeURIComponent("Upgrade to a paid plan")}`}
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm"
        >
          Contact us to upgrade
        </a>
      </div>
    </div>
  );
}
