import { dispatchWebhook } from "@/lib/webhooks/delivery";

import { db } from "../client";
import type { LeadEntity } from "../entities";

export interface CreateLeadParams {
  workspace: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  source?: string;
  status?: LeadEntity["status"];
  qualification?: Record<string, string>;
}

export async function createLead(params: CreateLeadParams): Promise<LeadEntity> {
  const lead = await db.lead.create({
    workspace: params.workspace,
    name: params.name,
    email: params.email,
    phone: params.phone ?? null,
    company: params.company ?? null,
    message: params.message ?? null,
    source: params.source ?? null,
    status: params.status ?? "new",
    qualification: params.qualification ?? {},
  });

  await dispatchWebhook(params.workspace, "lead.created", { lead });
  return lead;
}

export async function getWorkspaceLeads(workspaceId: string): Promise<LeadEntity[]> {
  return db.lead.getByWorkspace(workspaceId);
}

export async function getLeadById(id: string): Promise<LeadEntity | null> {
  try {
    return await db.lead.getById(id);
  } catch {
    return null;
  }
}

export async function updateLeadStatus(id: string, status: LeadEntity["status"]): Promise<LeadEntity> {
  return db.lead.update(id, { status });
}

export async function deleteLead(id: string): Promise<void> {
  await db.lead.delete(id);
}
