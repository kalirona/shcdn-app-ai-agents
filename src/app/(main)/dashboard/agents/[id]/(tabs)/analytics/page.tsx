"use client";

import { useEffect, useState } from "react";

import { useParams } from "next/navigation";

import { Bot, Calendar, CheckCircle, MessageSquare, TrendingUp, Users, XCircle } from "lucide-react";

import { getAgentById } from "@/lib/auth/actions/agent.actions";
import type { AgentEntity } from "@/lib/db/entities";
import { getAgentFromStorage } from "@/lib/db/storage-helper";

interface KPICardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

function KPICard({ label, value, icon }: KPICardProps) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">{icon}</div>
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="font-semibold text-2xl">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function AgentAnalyticsPage() {
  const params = useParams();
  const agentId = params.id as string;
  const [agent, setAgent] = useState<AgentEntity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const local = getAgentFromStorage(agentId);
      try {
        const result = await getAgentById(agentId);
        if (result.success && result.agent) {
          if (!cancelled) setAgent(result.agent as AgentEntity);
          if (!cancelled) setIsLoading(false);
          return;
        }
        if (result.error) {
          if (!cancelled) setError(result.error);
          if (!cancelled) setIsLoading(false);
          return;
        }
      } catch {
        // fall through
      }
      if (!cancelled) setAgent(local);
      if (!cancelled) setIsLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Agent not found.</p>
      </div>
    );
  }

  const stats = [
    { label: "Conversations", value: "0", icon: <MessageSquare className="size-5 text-muted-foreground" /> },
    { label: "AI Resolved", value: "0", icon: <Bot className="size-5 text-muted-foreground" /> },
    { label: "Leads Captured", value: "0", icon: <Users className="size-5 text-muted-foreground" /> },
    { label: "Bookings", value: "0", icon: <Calendar className="size-5 text-muted-foreground" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">Agent Performance</h3>
        <p className="text-muted-foreground text-sm">Track how this AI agent is performing.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <KPICard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <h4 className="mb-4 flex items-center gap-2 font-medium">
            <TrendingUp className="size-4" />
            Top Questions
          </h4>
          <p className="py-6 text-center text-muted-foreground text-sm">No data yet. Start chatting to see insights.</p>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <h4 className="mb-4 flex items-center gap-2 font-medium">
            <XCircle className="size-4" />
            Unanswered Questions
          </h4>
          <div className="flex flex-col items-center justify-center py-6">
            <CheckCircle className="size-8 text-green-500" />
            <p className="mt-2 text-muted-foreground text-sm">All questions answered!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
