"use client";

import { useEffect, useRef, useState } from "react";

import { Bot, Loader2, Send, User, AlertCircle } from "lucide-react";

interface PublicAgent {
  id: string;
  name: string;
  description: string | null;
  greeting: string;
  fallback_message: string;
  tone: string;
  language: string;
  status: string;
}

interface PublicMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string | null; url: string | null }>;
  isHuman?: boolean;
}

interface ChatResponse {
  content: string;
  sources: Array<{ title: string | null; url: string | null }>;
  confidence: number;
  status?: string;
  humanMessages?: Array<{ id: string; content: string; timestamp: string }>;
}

const API_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "";

function getSessionId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  let sessionId = localStorage.getItem("widget_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("widget_session_id", sessionId);
  }
  return sessionId;
}

export function PublicAgentChat({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [status, setStatus] = useState<"active" | "human_required" | "with_human" | "resolved">("active");
  const [sessionId] = useState(() => getSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/agents/${agentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setIsPageLoading(false);
          return;
        }
        setAgent(data);
        setMessages([{ id: crypto.randomUUID(), role: "assistant", content: data.greeting }]);
        setIsPageLoading(false);
      })
      .catch(() => {
        setIsPageLoading(false);
      });
  }, [agentId]);

  // Poll for human messages when conversation is not active
  useEffect(() => {
    if (!agent || status === "active") {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      if (!agent) return;
      try {
        const response = await fetch(`${API_BASE}/api/widget/chat?agentId=${agentId}&sessionId=${sessionId}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (response.ok) {
          const data: { status?: string; humanMessages?: Array<{ id: string; content: string; timestamp: string }> } = await response.json();
          if (data.humanMessages && data.humanMessages.length > 0) {
            const newHumanMessages = data.humanMessages.filter(
              (m: { id: string }) => m.id !== lastMessageIdRef.current,
            );
            if (newHumanMessages.length > 0) {
              lastMessageIdRef.current = newHumanMessages[newHumanMessages.length - 1].id;
              setMessages((prev) => [
                ...prev,
                ...newHumanMessages.map((m) => ({
                  id: crypto.randomUUID(),
                  role: "assistant" as const,
                  content: m.content,
                  isHuman: true,
                })),
              ]);
            }
          }
          if (data.status && data.status !== status) {
            setStatus(data.status as "active" | "human_required" | "with_human" | "resolved");
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [agent, status, sessionId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to latest message when list grows
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || isLoading || !agent) return;

    const userMessage: PublicMessage = { id: crypto.randomUUID(), role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/widget/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          sessionId,
          message: input,
        }),
      });

      const data: ChatResponse & { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to get a response");
      }

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: data.content, sources: data.sources, isHuman: false },
      ]);
      if (data.status) setStatus(data.status as "active" | "human_required" | "with_human" | "resolved");
      if (data.humanMessages && data.humanMessages.length > 0) {
        lastMessageIdRef.current = data.humanMessages[data.humanMessages.length - 1].id;
        setMessages((prev) => [
          ...prev,
          ...data.humanMessages!.map((m) => ({
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: m.content,
            isHuman: true,
          })),
        ]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `${agent.fallback_message}${message ? ` (${message})` : ""}`,
          isHuman: false,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  if (isPageLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <Bot className="size-12 text-muted-foreground" />
        <p className="mt-4 font-medium">Agent not found</p>
        <p className="text-muted-foreground text-sm">This AI agent is not available.</p>
      </div>
    );
  }

  const getStatusText = () => {
    switch (status) {
      case "human_required":
        return "Connecting you with a human agent...";
      case "with_human":
        return "You are now connected with a human agent";
      case "resolved":
        return "This conversation has been resolved";
      default:
        return "";
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      <header className="border-b bg-background/80 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
            <Bot className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="font-semibold">{agent.name}</h1>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-green-500" />
              <p className="text-muted-foreground text-xs">Online</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          {status !== "active" && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200">
              <AlertCircle className="size-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">{getStatusText()}</span>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  {msg.isHuman ? (
                    <User className="size-4 text-primary" />
                  ) : (
                    <Bot className="size-4 text-primary" />
                  )}
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : msg.isHuman
                      ? "border bg-blue-50"
                      : "border bg-muted/50"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.isHuman && (
                  <p className="mt-1 text-xs text-primary font-medium">Human agent</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="rounded-2xl border bg-muted/50 px-4 py-3 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="border-t bg-background/80 p-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            type="text"
            placeholder={status === "active" ? "Type your message..." : status === "resolved" ? "Conversation resolved" : "Waiting for human agent..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            disabled={isLoading || status !== "active"}
            className="flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            maxLength={2000}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading || !input.trim() || status !== "active"}
            className="rounded-xl bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground text-xs">Powered by Agent AI</p>
      </footer>
    </div>
  );
}
