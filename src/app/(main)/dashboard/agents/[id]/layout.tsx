"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BarChart3, Bot, FileText, Loader2, Palette, Settings2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AgentEntity } from "@/lib/db/entities";
import { getAgentFromStorage } from "@/lib/db/storage-helper";

function StatusBadge({ status }: { status: AgentEntity["status"] }) {
  const config = {
    draft: { label: "Draft", variant: "secondary" as const },
    active: { label: "Active", variant: "default" as const },
    paused: { label: "Paused", variant: "outline" as const },
  };

  const { label, variant } = config[status];

  return <Badge variant={variant}>{label}</Badge>;
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  const [agent, setAgent] = useState<AgentEntity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const found = getAgentFromStorage(agentId);
    if (found) {
      setAgent(found);
    } else {
      router.push("/dashboard/agents");
    }
    setIsLoading(false);
  }, [agentId, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/agents" className="text-muted-foreground hover:text-foreground">
          <span className="sr-only">Back</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="size-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-xl">{agent.name}</h1>
              <StatusBadge status={agent.status} />
            </div>
            {agent.description && <p className="text-muted-foreground text-sm">{agent.description}</p>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto">
          <TabsTrigger value="overview" asChild>
            <Link href={`/dashboard/agents/${agentId}/overview`}>
              <FileText className="size-3.5" />
              Overview
            </Link>
          </TabsTrigger>
          <TabsTrigger value="knowledge" asChild>
            <Link href={`/dashboard/agents/${agentId}/knowledge`}>
              <Bot className="size-3.5" />
              Knowledge
            </Link>
          </TabsTrigger>
          <TabsTrigger value="appearance" asChild>
            <Link href={`/dashboard/agents/${agentId}/appearance`}>
              <Palette className="size-3.5" />
              Appearance
            </Link>
          </TabsTrigger>
          <TabsTrigger value="analytics" asChild>
            <Link href={`/dashboard/agents/${agentId}/analytics`}>
              <BarChart3 className="size-3.5" />
              Analytics
            </Link>
          </TabsTrigger>
          <TabsTrigger value="settings" asChild>
            <Link href={`/dashboard/agents/${agentId}/settings`}>
              <Settings2 className="size-3.5" />
              Settings
            </Link>
          </TabsTrigger>
        </TabsList>
        {children}
      </Tabs>
    </div>
  );
}
