"use client";

import { useParams } from "next/navigation";

import { PublicAgentChat } from "@/components/public-agent-chat";

export default function PublicAgentPage() {
  const params = useParams();
  const agentId = params.agent as string;

  return <PublicAgentChat agentId={agentId} />;
}
