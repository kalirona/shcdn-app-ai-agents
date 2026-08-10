"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  Download,
  Loader2,
  MessageSquare,
  Search,
  User,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportConversations, getWorkspaceConversations } from "@/lib/auth/actions/conversation/conversation.actions";
import type { ConversationEntity, MessageEntity } from "@/lib/db/entities";

const WORKSPACE_ID = "placeholder-workspace-id";

function StatusBadge({ status }: { status: ConversationEntity["status"] }) {
  const config: Record<ConversationEntity["status"], { label: string; color: string }> = {
    active: { label: "Active", color: "border-green-200 text-green-700 bg-green-50" },
    human_required: { label: "Needs Human", color: "border-red-200 text-red-700 bg-red-50" },
    with_human: { label: "With Human", color: "border-yellow-200 text-yellow-700 bg-yellow-50" },
    resolved: { label: "Resolved", color: "border-muted-foreground/30 text-muted-foreground bg-muted/50" },
  };

  const { label, color } = config[status];

  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${color}`}>{label}</span>;
}

export default function ConversationDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [conversation, setConversation] = useState<ConversationEntity | null>(null);
  const [messages, setMessages] = useState<MessageEntity[]>([]);
  const [reply, setReply] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTakingOver, setIsTakingOver] = useState(false);

  useEffect(() => {
    const loadConversation = async () => {
      const { getConversationById } = await import("@/lib/auth/actions/conversation/conversation.actions");
      const result = await getConversationById(id);
      if (result.conversation) {
        setConversation(result.conversation);
        setMessages(result.messages);
      }
      setIsLoading(false);
    };

    loadConversation();
  }, [id]);

  async function handleReply() {
    if (!reply.trim() || isSending) return;
    setIsSending(true);

    const { sendMessage } = await import("@/lib/auth/actions/conversation/conversation.actions");
    const result = await sendMessage({ conversationId: id, content: reply });

    if (result.error) {
      toast.error(result.error);
    } else {
      setReply("");
      const { getConversationById } = await import("@/lib/auth/actions/conversation/conversation.actions");
      const updated = await getConversationById(id);
      setMessages(updated.messages);
    }

    setIsSending(false);
  }

  async function handleTakeOver() {
    setIsTakingOver(true);
    const { takeOverConversation } = await import("@/lib/auth/actions/conversation/conversation.actions");
    const result = await takeOverConversation(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("You've taken over this conversation.");
      setConversation((prev) => (prev ? { ...prev, status: "with_human" as const } : null));
    }
    setIsTakingOver(false);
  }

  async function handleReturnToAi() {
    const { returnToAi } = await import("@/lib/auth/actions/conversation/conversation.actions");
    const result = await returnToAi(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Conversation returned to AI.");
      setConversation((prev) => (prev ? { ...prev, status: "active" } : null));
    }
  }

  async function handleResolve() {
    const { resolveConversation } = await import("@/lib/auth/actions/conversation/conversation.actions");
    const result = await resolveConversation(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Conversation resolved.");
      setConversation((prev) => (prev ? { ...prev, status: "resolved" } : null));
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="size-12 text-muted-foreground" />
        <p className="mt-4 font-medium">Conversation not found</p>
        <Link href="/dashboard/conversations" className="mt-2 text-primary text-sm hover:underline">
          Back to conversations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/conversations" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-lg">{conversation.customer_name ?? "Anonymous Customer"}</h1>
              <StatusBadge status={conversation.status} />
            </div>
            {conversation.customer_email && (
              <p className="text-muted-foreground text-sm">{conversation.customer_email}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conversation.status !== "resolved" &&
            (conversation.status === "with_human" ? (
              <Button onClick={handleReturnToAi} variant="outline">
                <Bot />
                Return to AI
              </Button>
            ) : (
              <Button onClick={handleTakeOver} disabled={isTakingOver} variant="outline">
                {isTakingOver ? <Loader2 className="size-4 animate-spin" /> : <User />}
                Take Over
              </Button>
            ))}
          {conversation.status !== "resolved" && (
            <Button onClick={handleResolve}>
              <Check />
              Resolve
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="max-h-[500px] space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">No messages yet.</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role !== "user" && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="size-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "border bg-background"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 border-t border-muted-foreground/20 pt-2">
                      <p className="text-xs font-medium">Sources:</p>
                      {msg.sources.map((s, i) => (
                        <span key={i} className="mr-2 text-xs text-muted-foreground">
                          {s.title || "Source"}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs opacity-60">{new Date(msg.date_created).toLocaleTimeString()}</p>
                </div>
                {msg.role === "user" && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="size-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {conversation.status !== "resolved" && (
          <div className="border-t p-4">
            <div className="flex gap-2">
              <textarea
                placeholder="Type your reply..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleReply();
                  }
                }}
                disabled={isSending || conversation.status === "human_required" || conversation.status === "with_human"}
                className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                rows={2}
                maxLength={4000}
              />
              <Button onClick={handleReply} disabled={isSending || !reply.trim()}>
                {isSending ? <Loader2 className="size-4 animate-spin" /> : "Send"}
              </Button>
            </div>
            {conversation.status === "human_required" && (
              <p className="mt-2 text-muted-foreground text-xs">This conversation is waiting for a human response.</p>
            )}
            {conversation.status === "with_human" && (
              <p className="mt-2 text-muted-foreground text-xs">A human agent is handling this conversation.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
