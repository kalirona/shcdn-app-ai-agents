import { checkUsageLimit } from "@/lib/auth/actions/billing/billing.actions";
import type { PlanName } from "@/lib/auth/schemas/billing.schema";

export interface UsageEnforcementResult {
  allowed: boolean;
  error?: string;
  remaining?: number;
  limit?: number;
}

export async function enforceUsageLimit(
  workspaceId: string,
  metric: string,
): Promise<UsageEnforcementResult> {
  const result = await checkUsageLimit(
    workspaceId,
    metric as Parameters<typeof checkUsageLimit>[1],
  );

  if (result.error) {
    return { allowed: false, error: result.error };
  }

  if (!result.allowed) {
    return {
      allowed: false,
      error: `You've reached your ${metric.replace(/_/g, " ")} limit. Upgrade your plan to continue.`,
      remaining: 0,
      limit: result.limit,
    };
  }

  return {
    allowed: true,
    remaining: result.remaining,
    limit: result.limit,
  };
}

export async function enforceMessageLimit(workspaceId: string): Promise<UsageEnforcementResult> {
  return enforceUsageLimit(workspaceId, "ai_messages");
}

export async function enforceAgentLimit(workspaceId: string): Promise<UsageEnforcementResult> {
  return enforceUsageLimit(workspaceId, "agents");
}

export async function enforceDocumentLimit(workspaceId: string): Promise<UsageEnforcementResult> {
  return enforceUsageLimit(workspaceId, "documents");
}

export async function enforceTeamMemberLimit(workspaceId: string): Promise<UsageEnforcementResult> {
  return enforceUsageLimit(workspaceId, "team_members");
}

export async function enforceBookingLimit(workspaceId: string): Promise<UsageEnforcementResult> {
  return enforceUsageLimit(workspaceId, "bookings");
}
