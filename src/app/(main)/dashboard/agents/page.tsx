"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { Bot, MessageSquare, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AgentEntity } from "@/lib/db/entities";
import { getAgentsFromStorage } from "@/lib/db/storage-helper";

function StatusLabel({ status }: { status: AgentEntity["status"] }) {
  const labels: Record<AgentEntity["status"], string> = {
    draft: "Draft",
    active: "Active",
    paused: "Paused",
  };

  return <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">{labels[status]}</span>;
}

function AgentCard({ agent }: { agent: AgentEntity }) {
  return (
    <Link href={`/dashboard/agents/${agent.id}/overview`}>
      <Card className="transition-colors hover:border-muted-foreground/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-medium">{agent.name}</h3>
                <StatusLabel status={agent.status} />
              </div>
              {agent.description && (
                <p className="mt-1 truncate text-muted-foreground text-sm">{agent.description}</p>
              )}
              <div className="mt-2 flex items-center gap-3 text-muted-foreground text-xs">
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-3" />
                  0 conversations
                </span>
                <span>{agent.tone}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-3 w-32 rounded bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-16">
      <Bot className="size-12 text-muted-foreground" />
      <h3 className="mt-4 font-semibold text-lg">No agents yet</h3>
      <p className="mt-1 text-muted-foreground text-sm">Create your first AI agent to get started.</p>
      <Link href="/dashboard/agents/create" className="mt-4">
        <Button>
          <Plus />
          Create Agent
        </Button>
      </Link>
    </div>
  );
}

function AgentsGrid({ agents }: { agents: AgentEntity[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentEntity[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setAgents(getAgentsFromStorage());
    setIsLoaded(true);
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">My Agents</h1>
          <p className="text-muted-foreground">Create and manage your AI customer agents.</p>
        </div>
        <Link href="/dashboard/agents/create">
          <Button>
            <Plus />
            Create Agent
          </Button>
        </Link>
      </div>

      {!isLoaded && <LoadingGrid />}
      {isLoaded && agents.length === 0 && <EmptyState />}
      {isLoaded && agents.length > 0 && <AgentsGrid agents={agents} />}
    </div>
  );
}
