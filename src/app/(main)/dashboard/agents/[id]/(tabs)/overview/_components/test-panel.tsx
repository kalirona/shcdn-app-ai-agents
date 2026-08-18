"use client";

import { useState } from "react";

import { Bot, Loader2, Send, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { testAgentChat } from "@/lib/auth/actions/agent.actions";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string | null; url: string | null }>;
}

export function TestPanel({ agentId }: { agentId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSend() {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const result = await testAgentChat({
        agentId,
        message: input,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      if (result.error) {
        throw new Error(result.error);
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: result.content ?? "",
        sources: result.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot />
          Test Your Agent
        </CardTitle>
        <CardDescription>
          Try asking questions your customers might ask. The agent will respond using its knowledge base.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border bg-muted/30 p-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              Ask a question to test your agent&apos;s responses.
            </p>
          ) : (
            messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="size-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "border bg-background"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 border-muted-foreground/20 border-t pt-2">
                      <p className="font-medium text-xs">Sources:</p>
                      <ul className="mt-1 space-y-0.5">
                        {msg.sources.map((source, j) => (
                          <li key={`${source.title}-${j}`} className="text-xs">
                            {source.url ? (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {source.title || "Source"}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">{source.title || "Source"}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="size-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="rounded-lg border bg-background px-3 py-2">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={2}
            className="resize-none"
            maxLength={2000}
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="self-end">
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
