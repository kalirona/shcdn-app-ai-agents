import { type NextRequest, NextResponse } from "next/server";

import { ragQuery } from "@/lib/ai/rag-pipeline";
import { widgetChatSchema } from "@/lib/auth/schemas/widget.schema";
import { detectHandoffNeed } from "@/lib/auth/handoff";
import { getAgentById } from "@/lib/db/repositories/agent.repo";
import { createMessage, getConversationById, getOrCreateSessionConversation, updateConversationStatus } from "@/lib/db/repositories/conversation.repo";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import { buildWidgetCorsHeaders, isWidgetOriginAllowed } from "@/lib/security/widget-origins";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");

    if (!isWidgetOriginAllowed(request)) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }

    const rateLimit = checkRateLimit(`widget-chat:${origin ?? "unknown"}`, 20, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before sending more messages." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = widgetChatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { agentId, sessionId, message } = parsed.data;

    const agent = await getAgentById(agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.status !== "active") {
      return NextResponse.json({ error: "Agent is not active" }, { status: 400 });
    }

    // Get or create the conversation
    const conversation = await getOrCreateSessionConversation({
      sessionId,
      workspace: agent.workspace,
      agent: agent.id,
    });

    // Fetch conversation history for context
    const historyMessages = await (await import("@/lib/db/repositories/conversation.repo")).getConversationMessages(conversation.id);
    const history = historyMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    // Check conversation status - if not active, AI should not respond
    if (conversation.status !== "active") {
      // Return current status and recent messages (including human replies)
      const messages = await (await import("@/lib/db/repositories/conversation.repo")).getConversationMessages(conversation.id);
      const humanMessages = messages.filter((m) => m.role === "assistant" && m.metadata?.sender === "human");
      return NextResponse.json(
        {
          content: conversation.status === "human_required"
            ? "A human agent has been requested. Please wait for them to join."
            : conversation.status === "with_human"
              ? "A human agent is now handling this conversation."
              : "This conversation has been resolved.",
          sources: [],
          confidence: 0,
          status: conversation.status,
          humanMessages: humanMessages.map((m) => ({
            id: m.id,
            content: m.content,
            timestamp: m.date_created,
          })),
        },
        origin ? { headers: buildWidgetCorsHeaders(origin) } : undefined,
      );
    }

    // Check if visitor is requesting human handoff
    const handoff = detectHandoffNeed(message);
    let handoffTriggered = false;

    if (handoff.isHandoffRequired) {
      // Update conversation status to human_required
      await updateConversationStatus(conversation.id, "human_required", handoff.trigger, handoff.reason);
      // Create system message
      await createMessage({
        conversation: conversation.id,
        role: "system",
        content: "Conversation transferred to human support.",
        metadata: { handoffTrigger: handoff.trigger, handoffReason: handoff.reason },
      });
      handoffTriggered = true;
    }

    // Only call ragQuery if no handoff was triggered and status is still active
    let result: { content: string; sources: Array<{ title: string | null; url: string | null; chunkId: string }>; confidence: number } = { content: "", sources: [], confidence: 0 };
    if (!handoffTriggered) {
      result = await ragQuery({
        agent,
        query: message,
        history,
        conversationId: sessionId,
      });
    } else {
      result.content = "I've requested a human agent to assist you. They'll be with you shortly.";
    }

    // Best-effort persistence: never let a failed write break the chat reply.
    try {
      await createMessage({
        conversation: conversation.id,
        role: "user",
        content: message,
      });
      if (!handoffTriggered) {
        await createMessage({
          conversation: conversation.id,
          role: "assistant",
          content: result.content,
          sources: result.sources.map((s) => ({ title: s.title ?? "Knowledge source", url: s.url, chunk_id: s.chunkId })),
        });
      } else {
        // For handoff, we store the AI's acknowledgment as a system message already created
        await createMessage({
          conversation: conversation.id,
          role: "assistant",
          content: result.content,
          metadata: { handoffAcknowledgment: true },
        });
      }
    } catch (error) {
      console.error("Failed to persist widget chat:", error);
    }

    // Get recent human messages to return to visitor
    const messages = await (await import("@/lib/db/repositories/conversation.repo")).getConversationMessages(conversation.id);
    const humanMessages = messages.filter((m) => m.role === "assistant" && m.metadata?.sender === "human");

    return NextResponse.json(
      {
        content: result.content,
        sources: result.sources,
        confidence: result.confidence,
        status: handoffTriggered ? "human_required" : conversation.status,
        humanMessages: humanMessages.map((m) => ({
          id: m.id,
          content: m.content,
          timestamp: m.date_created,
        })),
      },
      origin ? { headers: buildWidgetCorsHeaders(origin) } : undefined,
    );
  } catch (error) {
    console.error("Widget chat error:", error);
    return NextResponse.json({ error: "An error occurred while processing your message." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");

    if (!isWidgetOriginAllowed(request)) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const sessionId = searchParams.get("sessionId");

    if (!agentId || !sessionId) {
      return NextResponse.json({ error: "agentId and sessionId are required" }, { status: 400 });
    }

    const agent = await getAgentById(agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get or create the conversation
    const conversation = await getOrCreateSessionConversation({
      sessionId,
      workspace: agent.workspace,
      agent: agent.id,
    });

    // Get conversation messages
    const messages = await (await import("@/lib/db/repositories/conversation.repo")).getConversationMessages(conversation.id);
    const humanMessages = messages.filter((m) => m.role === "assistant" && m.metadata?.sender === "human");

    return NextResponse.json(
      {
        status: conversation.status,
        humanMessages: humanMessages.map((m) => ({
          id: m.id,
          content: m.content,
          timestamp: m.date_created,
        })),
      },
      origin ? { headers: buildWidgetCorsHeaders(origin) } : undefined,
    );
  } catch (error) {
    console.error("Widget chat status error:", error);
    return NextResponse.json({ error: "An error occurred while fetching conversation status." }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  if (!isWidgetOriginAllowed(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: buildWidgetCorsHeaders(request.headers.get("origin")),
  });
}
