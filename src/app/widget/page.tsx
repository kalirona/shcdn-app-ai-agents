"use client";

import { useEffect, useRef, useState } from "react";

import { Bot, MessageSquare, Send, X } from "lucide-react";

interface WidgetMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string | null; url: string | null }>;
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

const API_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "";

export default function WidgetPage() {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

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

      const data = await response.json();

      setMessages((prev) => [...prev, { role: "assistant", content: data.content, sources: data.sources }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: config.fallbackMessage }]);
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
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div
                    className="flex size-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${config.primaryColor}20` }}
                  >
                    <Bot className="size-4" style={{ color: config.primaryColor }} />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user" ? "text-white" : "border bg-background"
                  }`}
                  style={msg.role === "user" ? { backgroundColor: config.primaryColor } : undefined}
                >
                  {msg.content}
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
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                disabled={isLoading}
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ focusRingColor: config.primaryColor } as React.CSSProperties}
                maxLength={2000}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
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
