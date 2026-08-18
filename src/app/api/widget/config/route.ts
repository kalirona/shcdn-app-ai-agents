import { type NextRequest, NextResponse } from "next/server";

import { getAgentById } from "@/lib/db/repositories/agent.repo";
import { widgetConfigSchema } from "@/lib/auth/schemas/widget.schema";
import { buildWidgetCorsHeaders, isWidgetOriginAllowed } from "@/lib/security/widget-origins";

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!isWidgetOriginAllowed(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent");

  if (!agentId) {
    return NextResponse.json({ error: "Agent ID is required" }, { status: 400 });
  }

  const parsed = widgetConfigSchema.pick({ agentId: true }).safeParse({ agentId });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 });
  }

  const agent = await getAgentById(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      agentId: agent.id,
      name: agent.name,
      greeting: agent.greeting,
      fallbackMessage: agent.fallback_message,
      tone: agent.tone,
      position: "bottom-right",
      primaryColor: "#3b82f6",
      showSources: true,
    },
    origin ? { headers: buildWidgetCorsHeaders(origin) } : undefined,
  );
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
