export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your AI agents and business performance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Conversations", value: "0", color: "text-blue-600" },
          { label: "AI Resolved", value: "0", color: "text-green-600" },
          { label: "Leads Captured", value: "0", color: "text-purple-600" },
          { label: "Bookings", value: "0", color: "text-orange-600" },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl border bg-background p-5 transition-shadow hover:shadow-sm">
            <p className="text-muted-foreground text-sm">{metric.label}</p>
            <p className={`mt-2 font-bold text-3xl ${metric.color}`}>{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-muted-foreground text-sm">
          Create your first AI agent to start seeing analytics here.
        </p>
      </div>
    </div>
  );
}
