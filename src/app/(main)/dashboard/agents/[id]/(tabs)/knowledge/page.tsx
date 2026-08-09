"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FileText, Globe, MessageSquare, Plus, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AddFaqSourceDialog,
  AddDocumentSourceDialog,
  AddTextSourceDialog,
  AddWebsiteSourceDialog,
  KnowledgeSourceCard,
  getKnowledgeSourcesForAgent,
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
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setSources(getKnowledgeSourcesForAgent(agentId));
  }, [agentId, refreshKey]);

  function handleSuccess() {
    setRefreshKey((k) => k + 1);
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
          <AddWebsiteSourceDialog agentId={agentId} />
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
            <AddWebsiteSourceDialog agentId={agentId} />
            <AddDocumentSourceDialog agentId={agentId} onSuccess={handleSuccess} />
            <AddFaqSourceDialog agentId={agentId} onSuccess={handleSuccess} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">{sources.length} source{sources.length !== 1 ? "s" : ""}</p>
          {sources.map((source) => (
            <KnowledgeSourceCard key={source.id} source={source} onDelete={handleSuccess} />
          ))}
        </div>
      )}
    </div>
  );
}
