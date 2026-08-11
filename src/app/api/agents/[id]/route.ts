import { type NextRequest, NextResponse } from "next/server";

import { getAgentById } from "@/lib/db/repositories/agent.repo";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const agent = await getAgentById(id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    greeting: agent.greeting,
    fallback_message: agent.fallback_message,
    tone: agent.tone,
    language: agent.language,
    system_prompt: agent.system_prompt,
    status: agent.status,
    workspace: agent.workspace,
  });
}
