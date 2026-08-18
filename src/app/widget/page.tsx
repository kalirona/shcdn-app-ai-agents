"use client";

import { useEffect, useRef, useState } from "react";

import { Bot, MessageSquare, Send, X, User, AlertCircle, Loader2 } from "lucide-react";

interface WidgetMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string | null; url: string | null }>;
  isHuman?: boolean;
}

interface WidgetConfig {
  agentId: string;
  name: string;
  greeting: string;
  fallbackMessage: string;
  position: "bottom-right" | "bottom-left";
  primaryColor: string;
  showSources: boolean;
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

export default function WidgetPage() {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"active" | "human_required" | "with_human" | "resolved">("active");
  const [sessionId] = useState(() => getSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const agentId = params.get("agent");

    if (!agentId) return;

    fetch(`${API_BASE}/api/widget/config?agent=${agentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) return;
        setConfig(data);
        if (data.greeting) {
          setMessages([{ role: "assistant", content: data.greeting }]);
        }
      })
      .catch(console.error);
  }, []);

  // Poll for human messages when conversation is not active
  useEffect(() => {
    if (!config || status === "active") {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      if (!config) return;
      try {
        const response = await fetch(`${API_BASE}/api/widget/chat?agentId=${config.agentId}&sessionId=${sessionId}`, {
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
  }, [config, status, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || isLoading || !config) return;

    const userMessage: WidgetMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/widget/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: config.agentId,
          sessionId,
          message: input,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data: ChatResponse = await response.json();

      setMessages((prev) => [...prev, { role: "assistant", content: data.content, sources: data.sources, isHuman: false }]);
      if (data.status) setStatus(data.status as "active" | "human_required" | "with_human" | "resolved");
      if (data.humanMessages && data.humanMessages.length > 0) {
        lastMessageIdRef.current = data.humanMessages[data.humanMessages.length - 1].id;
        setMessages((prev) => [
          ...prev,
          ...data.humanMessages!.map((m) => ({
            role: "assistant" as const,
            content: m.content,
            isHuman: true,
          })),
        ]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: config.fallbackMessage, isHuman: false }]);
    } finally {
      setIsLoading(false);
    }
  }

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent">
        <div className="text-muted-foreground text-sm">Loading...</div>
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
    <div className="flex h-screen flex-col bg-transparent">
      {isOpen ? (
        <div className="flex h-full flex-col overflow-hidden rounded-t-lg border bg-background shadow-xl">
          <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: config.primaryColor }}>
            <div className="flex items-center gap-2">
              <Bot className="size-5 text-white" />
              <span className="font-medium text-white">{config.name}</span>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
              <X className="size-5" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {status !== "active" && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200">
                <AlertCircle className="size-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">{getStatusText()}</span>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div
                    className="flex size-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: msg.isHuman ? `${config.primaryColor}20` : `${config.primaryColor}20` }}
                  >
                    {msg.isHuman ? (
                      <User className="size-4" style={{ color: config.primaryColor }} />
                    ) : (
                      <Bot className="size-4" style={{ color: config.primaryColor }} />
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "text-white"
                      : msg.isHuman
                        ? "border bg-blue-50"
                        : "border bg-background"
                  }`}
                  style={msg.role === "user" ? { backgroundColor: config.primaryColor } : undefined}
                >
                  {msg.content}
                  {msg.isHuman && (
                    <p className="mt-1 text-xs text-primary font-medium">Human agent</p>
                  )}
                  {msg.sources && msg.sources.length > 0 && config.showSources && (
                    <div className="mt-2 border-muted-foreground/20 border-t pt-2">
                      <p className="font-medium text-xs">Sources:</p>
                      {msg.sources.map((s, j) => (
                        <a
                          key={j}
                          href={s.url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-primary text-xs hover:underline"
                        >
                          {s.title || "Source"}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div
                  className="flex size-7 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${config.primaryColor}20` }}
                >
                  <Bot className="size-4 animate-pulse" style={{ color: config.primaryColor }} />
                </div>
                <div className="rounded-lg border bg-background px-3 py-2 text-muted-foreground text-sm">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={status === "active" ? "Type a message..." : status === "resolved" ? "Conversation resolved" : "Waiting for human agent..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                disabled={isLoading || status !== "active"}
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ focusRingColor: config.primaryColor } as React.CSSProperties}
                maxLength={2000}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={isLoading || !input.trim() || status !== "active"}
                className="rounded-md p-2 text-white disabled:opacity-50"
                style={{ backgroundColor: config.primaryColor }}
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="ml-auto flex size-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
          style={{ backgroundColor: config.primaryColor }}
        >
          <MessageSquare className="size-6 text-white" />
        </button>
      )}
    </div>
  );
}
