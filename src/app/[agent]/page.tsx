"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Bot, Loader2, Send } from "lucide-react";

interface PublicAgent {
  id: string;
  name: string;
  description: string | null;
  greeting: string;
  fallback_message: string;
  tone: string;
  language: string;
  system_prompt: string | null;
  status: string;
  workspace: string;
}

interface PublicMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string | null; url: string | null }>;
}

export default function PublicAgentPage() {
  const params = useParams();
  const agentId = params.agent as string;
  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/agents/${agentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setIsPageLoading(false);
          return;
        }
        setAgent(data);
        setMessages([{ role: "assistant", content: data.greeting }]);
        setIsPageLoading(false);
      })
      .catch(() => {
        setIsPageLoading(false);
      });
  }, [agentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || isLoading || !agent) return;

    const userMessage: PublicMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Thanks for your message! This is a demo response from ${agent.name}. In production, this would connect to the AI backend to provide real answers based on your knowledge base.`,
        },
      ]);
      setIsLoading(false);
    }, 1000);
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
          {messages.map((msg, i) => (
            <div
              key={`${msg.role}-${i}`}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="size-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border bg-muted/50"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
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
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            disabled={isLoading}
            className="flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            maxLength={2000}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground text-xs">
          Powered by Agent AI
        </p>
      </footer>
    </div>
  );
}
