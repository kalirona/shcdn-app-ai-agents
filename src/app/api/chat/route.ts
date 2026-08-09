import { type NextRequest, NextResponse } from "next/server";

import { type RagContext, ragQuery } from "@/lib/ai/rag-pipeline";
import { getAgentById } from "@/lib/auth/actions/agent.actions";
import { chatRequestSchema } from "@/lib/auth/schemas/rag.schema";
import { checkRateLimit } from "@/lib/security/rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);

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

    const result = await ragQuery(context);

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
