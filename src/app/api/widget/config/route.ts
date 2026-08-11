import { type NextRequest, NextResponse } from "next/server";

import { getAgentById } from "@/lib/db/repositories/agent.repo";
import { widgetConfigSchema } from "@/lib/auth/schemas/widget.schema";

function getAllowedOrigins(): string[] {
  return process.env.ALLOWED_WIDGET_ORIGINS?.split(",").map((o) => o.trim()) ?? [];
}

function _validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.length === 0) return true;

  return allowedOrigins.some((allowed) => {
    if (allowed.startsWith("*.")) {
      const domain = allowed.slice(2);
      return origin.endsWith(domain) || origin === `https://${domain}`;
    }
    return origin === allowed;
  });
}

export async function GET(request: NextRequest) {
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

  return NextResponse.json({
    agentId: agent.id,
    name: agent.name,
    greeting: agent.greeting,
    fallbackMessage: agent.fallback_message,
    tone: agent.tone,
    position: "bottom-right",
    primaryColor: "#3b82f6",
    showSources: true,
  });
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "*";

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
