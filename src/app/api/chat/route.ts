import { type NextRequest, NextResponse } from "next/server";

import { type RagContext, ragQuery } from "@/lib/ai/rag-pipeline";
import { getAgentById } from "@/lib/auth/actions/agent.actions";
import { chatRequestSchema } from "@/lib/auth/schemas/rag.schema";
import { createMessage, getOrCreateSessionConversation } from "@/lib/db/repositories/conversation.repo";
import { checkRateLimit } from "@/lib/security/rate-limiter";

const CHAT_API_SECRET = process.env.CHAT_API_SECRET ?? "";

function authenticate(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return false;
  // Fail closed: if the secret is unset in the environment, no token is accepted.
  return CHAT_API_SECRET.length > 0 && token === CHAT_API_SECRET;
}

export async function POST(request: NextRequest) {
  try {
    if (!authenticate(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.slice("Bearer ".length);

    const rateLimit = checkRateLimit(`chat:${token}`, 30, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before sending more messages." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { agentId, message, conversationId, history } = parsed.data;

    const agentResult = await getAgentById(agentId);
    if (!agentResult.agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agent = agentResult.agent;

    if (agent.status !== "active") {
      return NextResponse.json({ error: "Agent is not active" }, { status: 400 });
    }

    const context: RagContext = {
      agent,
      query: message,
      history: history ?? [],
      conversationId,
    };

    // Resolve (or create) the conversation up-front so tools like request_human
    // receive the real conversation UUID instead of the raw client session id —
    // passing a non-UUID session id into a conversation-scoped tool made Postgres
    // throw (22P02) and the agent fabricate an "internal error" apology.
    let conversation: { id: string } | null = null;
    if (conversationId) {
      try {
        conversation = await getOrCreateSessionConversation({
          sessionId: conversationId,
          workspace: agent.workspace,
          agent: agent.id,
        });
      } catch (e) {
        console.error("Failed to resolve conversation in /api/chat:", e);
      }
    }

    context.conversationId = conversation?.id ?? conversationId;

    const result = await ragQuery(context);

    // Best-effort persistence: never let a failed write break the chat reply.
    if (conversation) {
      try {
        await createMessage({ conversation: conversation.id, role: "user", content: message });
        await createMessage({
          conversation: conversation.id,
          role: "assistant",
          content: result.content,
          sources: result.sources.map((s) => ({
            title: s.title ?? "Knowledge source",
            url: s.url,
            chunk_id: s.chunkId,
          })),
        });
      } catch (error) {
        console.error("Failed to persist chat:", error);
      }
    }

    return NextResponse.json({
      content: result.content,
      sources: result.sources,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "An error occurred while processing your request." }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
