"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Bot, Calendar, Copy, ExternalLink, MessageSquare, Pause, Play, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AgentEntity } from "@/lib/db/entities";
import { getAgentFromStorage, saveAgentToStorage } from "@/lib/db/storage-helper";

type AgentStatus = AgentEntity["status"];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-medium text-sm">{value}</span>
    </div>
  );
}

export default function OverviewPage() {
  const params = useParams();
  const agentId = params.id as string;
  const [agent, setAgent] = useState<AgentEntity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const found = getAgentFromStorage(agentId);
    if (found) setAgent(found);
    setIsLoading(false);
  }, [agentId]);

  async function toggleStatus() {
    if (!agent) return;
    const newStatus: AgentEntity["status"] = agent.status === "active" ? "paused" : "active";
    const updated: AgentEntity = { ...agent, status: newStatus, date_updated: new Date().toISOString() };
    saveAgentToStorage(updated);
    setAgent(updated);
    toast.success(`Agent ${newStatus === "active" ? "activated" : "paused"}.`);
  }

  function copyPublicLink() {
    const link = `${window.location.origin}/a/${agentId}`;
    navigator.clipboard.writeText(link);
    toast.success("Public link copied!");
  }

  function copyEmbedCode() {
    const code = `<script src="${window.location.origin}/widget.js" data-agent="${agentId}"><\/script>`;
    navigator.clipboard.writeText(code);
    toast.success("Embed code copied!");
  }

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
      {/* Quick Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={agent.status === "active" ? "default" : "outline"}
          size="sm"
          onClick={toggleStatus}
        >
          {agent.status === "active" ? (
            <>
              <Pause className="size-3.5" />
              Pause Agent
            </>
          ) : (
            <>
              <Play className="size-3.5" />
              Activate Agent
            </>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={copyPublicLink}>
          <ExternalLink className="size-3.5" />
          Public Link
        </Button>
        <Button variant="outline" size="sm" onClick={copyEmbedCode}>
          <Copy className="size-3.5" />
          Embed Code
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <span className={`size-2 rounded-full ${agent.status === "active" ? "bg-green-500" : agent.status === "paused" ? "bg-yellow-500" : "bg-muted-foreground"}`} />
          <span className="text-sm capitalize">{agent.status}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Conversations", value: "0", icon: MessageSquare },
          { label: "AI Resolved", value: "0", icon: Zap },
          { label: "Knowledge Sources", value: "—", icon: Bot },
          { label: "Created", value: new Date(agent.date_created).toLocaleDateString(), icon: Calendar },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">{stat.label}</p>
                  <p className="font-semibold text-xl">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Config + Behavior */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agent Configuration</CardTitle>
            <CardDescription>Current settings for this agent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow label="Name" value={agent.name} />
            <Separator />
            <InfoRow label="Status" value={agent.status} />
            <Separator />
            <InfoRow label="Tone" value={agent.tone} />
            <Separator />
            <InfoRow label="Language" value={agent.language.toUpperCase()} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Behavior</CardTitle>
            <CardDescription>How this agent communicates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <p className="font-medium text-sm">Greeting</p>
              <p className="rounded-md bg-muted p-3 text-sm">{agent.greeting}</p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-sm">Fallback Message</p>
              <p className="rounded-md bg-muted p-3 text-sm">{agent.fallback_message}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Prompt */}
      {agent.system_prompt && (
        <Card>
          <CardHeader>
            <CardTitle>System Prompt</CardTitle>
            <CardDescription>The AI instructions that guide this agent&apos;s behavior.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-sm">
              {agent.system_prompt}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
