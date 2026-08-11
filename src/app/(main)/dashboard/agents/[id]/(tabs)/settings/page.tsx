"use client";

import { useEffect, useState } from "react";

import { useParams, useRouter } from "next/navigation";

import { AlertTriangle, Check, Pause, Play, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAgentById, updateAgent } from "@/lib/auth/actions/agent.actions";
import type { AgentEntity } from "@/lib/db/entities";
import { deleteAgentFromStorage, getAgentFromStorage, saveAgentToStorage } from "@/lib/db/storage-helper";

import { PublicAgentCard } from "./_components/public-agent-card";

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  const [agent, setAgent] = useState<AgentEntity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const local = getAgentFromStorage(agentId);
      try {
        const result = await getAgentById(agentId);
        if (result.success && result.agent) {
          saveAgentToStorage(result.agent as AgentEntity);
          if (!cancelled) setAgent(result.agent as AgentEntity);
          if (!cancelled) setIsLoading(false);
          return;
        }
      } catch {
        // fall through
      }
      if (local) {
        if (!cancelled) setAgent(local);
      } else {
        router.push("/dashboard/agents");
      }
      if (!cancelled) setIsLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [agentId, router]);

  async function handleStatusChange(newStatus: AgentEntity["status"]) {
    if (!agent) return;
    const updated = { ...agent, status: newStatus, date_updated: new Date().toISOString() };
    saveAgentToStorage(updated);
    setAgent(updated);
    const result = await updateAgent(agentId, { status: newStatus });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        `Agent ${newStatus === "active" ? "activated" : newStatus === "paused" ? "paused" : "saved as draft"}.`,
      );
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      deleteAgentFromStorage(agentId);
      toast.success("Agent deleted successfully.");
      router.push("/dashboard/agents");
    } catch {
      toast.error("Failed to delete agent.");
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PublicAgentCard agentId={agentId} />

      {/* Status Control */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Status</CardTitle>
          <CardDescription>Control whether your AI agent is active and responding to customers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant={agent.status === "active" ? "default" : "outline"}
              onClick={() => handleStatusChange("active")}
              className="flex-1"
            >
              <Play className="size-4" />
              Active
            </Button>
            <Button
              variant={agent.status === "paused" ? "default" : "outline"}
              onClick={() => handleStatusChange("paused")}
              className="flex-1"
            >
              <Pause className="size-4" />
              Paused
            </Button>
            <Button
              variant={agent.status === "draft" ? "default" : "outline"}
              onClick={() => handleStatusChange("draft")}
              className="flex-1"
            >
              <AlertTriangle className="size-4" />
              Draft
            </Button>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted p-3">
            <span
              className={`size-2 rounded-full ${agent.status === "active" ? "bg-green-500" : agent.status === "paused" ? "bg-yellow-500" : "bg-muted-foreground"}`}
            />
            <span className="text-sm">
              Currently <span className="font-medium capitalize">{agent.status}</span>
              {agent.status === "active" && " — Agent is live and responding to customers"}
              {agent.status === "paused" && " — Agent is paused and not accepting new conversations"}
              {agent.status === "draft" && " — Agent is in draft mode and not publicly available"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Agent Info */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Settings</CardTitle>
          <CardDescription>Configure advanced settings for this agent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-4">
            <p className="text-muted-foreground text-sm">
              Agent ID: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{agentId}</code>
            </p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-muted-foreground text-sm">
              Created: <span className="font-medium">{new Date(agent.date_created).toLocaleDateString()}</span>
            </p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-muted-foreground text-sm">
              Last Updated: <span className="font-medium">{new Date(agent.date_updated).toLocaleDateString()}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Delete */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions for this agent.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border border-destructive/30 p-4">
            <div>
              <p className="font-medium">Delete this agent</p>
              <p className="text-muted-foreground text-sm">Permanently delete this agent and all associated data.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  <Trash2 />
                  Delete Agent
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Agent</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;{agent.name}&quot;? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
