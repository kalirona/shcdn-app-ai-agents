"use client";

import { useEffect, useState } from "react";

import { useParams } from "next/navigation";

import { FileText } from "lucide-react";

import { getAgentById } from "@/lib/auth/actions/agent.actions";

import {
  AddDocumentSourceDialog,
  AddFaqSourceDialog,
  AddTextSourceDialog,
  AddWebsiteSourceDialog,
  KnowledgeSourceCard,
  loadKnowledgeSources,
} from "./_components/knowledge-dialogs";

interface KnowledgeSource {
  id: string;
  workspace: string;
  agent: string | null;
  type: "website" | "document" | "faq" | "text";
  title: string;
  url: string | null;
  fileName: string | null;
  status: "pending" | "processing" | "ready" | "failed";
  chunkCount: number;
  dateCreated: string;
  content?: string;
}

export default function KnowledgePage() {
  const params = useParams();
  const agentId = params.id as string;
  const [sources, setSources] = useState<KnowledgeSource[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const agent = await getAgentById(agentId);
        const workspaceId = agent.agent?.workspace;
        if (!workspaceId || cancelled) return;
        setSources(await loadKnowledgeSources(agentId, workspaceId));
      } catch {
        if (!cancelled) setSources([]);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  async function handleSuccess() {
    const agent = await getAgentById(agentId);
    const workspaceId = agent.agent?.workspace;
    if (!workspaceId) return;
    setSources(await loadKnowledgeSources(agentId, workspaceId));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-medium">Knowledge Sources</h3>
          <p className="text-muted-foreground text-sm">Teach your AI agent about your business.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddTextSourceDialog agentId={agentId} onSuccess={handleSuccess} />
          <AddWebsiteSourceDialog agentId={agentId} onSuccess={handleSuccess} />
          <AddDocumentSourceDialog agentId={agentId} onSuccess={handleSuccess} />
          <AddFaqSourceDialog agentId={agentId} onSuccess={handleSuccess} />
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-16">
          <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
            <FileText className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-semibold text-lg">No knowledge sources</h3>
          <p className="mt-1 max-w-sm text-center text-muted-foreground text-sm">
            Add knowledge sources to teach your AI agent about your business, products, and policies.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <AddTextSourceDialog agentId={agentId} onSuccess={handleSuccess} />
            <AddWebsiteSourceDialog agentId={agentId} onSuccess={handleSuccess} />
            <AddDocumentSourceDialog agentId={agentId} onSuccess={handleSuccess} />
            <AddFaqSourceDialog agentId={agentId} onSuccess={handleSuccess} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            {sources.length} source{sources.length !== 1 ? "s" : ""}
          </p>
          {sources.map((source) => (
            <KnowledgeSourceCard key={source.id} source={source} onDelete={handleSuccess} />
          ))}
        </div>
      )}
    </div>
  );
}
