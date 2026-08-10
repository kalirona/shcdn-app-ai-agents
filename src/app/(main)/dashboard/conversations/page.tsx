"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { Download, Loader2, MessageSquare, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportConversations, getWorkspaceConversations } from "@/lib/auth/actions/conversation/conversation.actions";
import type { ConversationEntity } from "@/lib/db/entities";

const WORKSPACE_ID = "placeholder-workspace-id";

function StatusDot({ status }: { status: ConversationEntity["status"] }) {
  const colors: Record<ConversationEntity["status"], string> = {
    active: "bg-green-500",
    human_required: "bg-red-500",
    with_human: "bg-yellow-500",
    resolved: "bg-muted-foreground",
  };

  return <span className={`size-2 rounded-full ${colors[status]}`} />;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const loadConversations = async () => {
      const result = await getWorkspaceConversations(WORKSPACE_ID);
      if (result.conversations) {
        setConversations(result.conversations);
      }
      setIsLoading(false);
    };

    loadConversations();
  }, []);

  async function handleExport() {
    const result = await exportConversations(WORKSPACE_ID, "csv");
    if (result.error || !result.data || !result.filename) {
      toast.error(result.error ?? "Export failed");
      return;
    }

    const blob = new Blob([result.data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Conversations</h1>
          <p className="text-muted-foreground">Monitor and manage all customer conversations.</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download />
          Export
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            maxLength={200}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="handoff">Needs Human</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <MessageSquare className="size-12 text-muted-foreground" />
          <h3 className="mt-4 font-semibold text-lg">No conversations</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            {search
              ? "No conversations match your search."
              : "When customers start chatting, conversations will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/dashboard/conversations/${conversation.id}`}
              className="block rounded-lg border p-4 transition-colors hover:border-muted-foreground/50"
            >
              <div className="flex items-center gap-3">
                <StatusDot status={conversation.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium text-sm">
                      {conversation.customer_name ?? "Anonymous Customer"}
                    </h3>
                    <span className="text-muted-foreground text-xs">
                      {new Date(conversation.date_created).toLocaleDateString()}
                    </span>
                  </div>
                  {conversation.customer_email && (
                    <p className="truncate text-muted-foreground text-xs">{conversation.customer_email}</p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                    conversation.status === "human_required"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : conversation.status === "with_human"
                        ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                        : conversation.status === "resolved"
                          ? "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                          : "border-green-200 bg-green-50 text-green-700"
                  }`}
                >
                  {conversation.status === "human_required"
                    ? "Needs Human"
                    : conversation.status === "with_human"
                      ? "With Human"
                      : conversation.status === "resolved"
                        ? "Resolved"
                        : "Active"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
