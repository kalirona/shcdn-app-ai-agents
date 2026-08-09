import { type NextRequest, NextResponse } from "next/server";

import { ragQuery } from "@/lib/ai/rag-pipeline";
import { getAgentById } from "@/lib/auth/actions/agent.actions";
import { widgetChatSchema } from "@/lib/auth/schemas/widget.schema";
import { checkRateLimit } from "@/lib/security/rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");

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

    const agentResult = await getAgentById(agentId);
    if (!agentResult.agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agent = agentResult.agent;

    if (agent.status !== "active") {
      return NextResponse.json({ error: "Agent is not active" }, { status: 400 });
    }

    const result = await ragQuery({
      agent,
      query: message,
      history: [],
      conversationId: sessionId,
    });

    const responseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (origin) {
      responseHeaders["Access-Control-Allow-Origin"] = origin;
    }

    return NextResponse.json(
      {
        content: result.content,
        sources: result.sources,
        confidence: result.confidence,
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    console.error("Widget chat error:", error);
    return NextResponse.json({ error: "An error occurred while processing your message." }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "*";

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
