"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Eye } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentEntity } from "@/lib/db/entities";
import { getAgentFromStorage } from "@/lib/db/storage-helper";
import { WidgetCustomizationCard, WidgetEmbedCard } from "./_components/widget-embed-card";

export default function AppearancePage() {
  const params = useParams();
  const agentId = params.id as string;
  const [agent, setAgent] = useState<AgentEntity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const found = getAgentFromStorage(agentId);
    if (found) setAgent(found);
    setIsLoading(false);
  }, [agentId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading...</p>
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

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye />
              Widget Preview
            </CardTitle>
            <CardDescription>How your chat widget will appear on your website.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/50 p-8">
              <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-foreground" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="font-medium">{agent.name}</p>
              <p className="text-muted-foreground text-sm">Chat with us</p>
              <div className="mt-4 w-full max-w-xs rounded-lg border bg-background p-3 shadow-sm">
                <p className="text-sm">{agent.greeting}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <WidgetCustomizationCard />
      </div>

      <WidgetEmbedCard agentId={agentId} />
    </div>
  );
}
