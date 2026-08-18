"use server";

import { revalidatePath } from "next/cache";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { PERMISSIONS } from "@/lib/auth/roles";
import type { LeadEntity } from "@/lib/db/entities";
import * as leadRepo from "@/lib/db/repositories/lead.repo";

export async function getWorkspaceLeads(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.LEADS_READ);

  try {
    const leads = await leadRepo.getWorkspaceLeads(workspaceId);
    return { success: true, leads };
  } catch (error) {
    console.error("Failed to fetch leads:", error);
    return { error: "Failed to load leads.", leads: [] };
  }
}

export async function updateLeadStatus(leadId: string, status: LeadEntity["status"]) {
  try {
    const lead = await leadRepo.getLeadById(leadId);
    if (!lead) {
      return { error: "Lead not found." };
    }
    await requireWorkspaceAccess(lead.workspace, PERMISSIONS.LEADS_MANAGE);

    await leadRepo.updateLeadStatus(leadId, status);
    revalidatePath("/dashboard/leads");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to update lead status:", error);
    return { error: "Failed to update lead status." };
  }
}

export async function createLead(data: {
  workspaceId: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  source?: string;
}) {
  try {
    await requireWorkspaceAccess(data.workspaceId, PERMISSIONS.LEADS_MANAGE);

    const lead = await leadRepo.createLead({
      workspace: data.workspaceId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      message: data.message,
      source: data.source,
    });

    revalidatePath("/dashboard/leads");
    return { success: true, lead };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to create lead:", error);
    return { error: "Failed to create lead." };
  }
}

export async function exportLeads(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.LEADS_MANAGE);

  try {
    const leads = await leadRepo.getWorkspaceLeads(workspaceId);

    const headers = ["Name", "Email", "Phone", "Company", "Message", "Source", "Status", "Date"];
    const rows = leads.map((l) => [
      l.name,
      l.email,
      l.phone ?? "",
      l.company ?? "",
      l.message ?? "",
      l.source ?? "",
      l.status,
      l.date_created,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    return { success: true, data: csv, filename: "leads.csv" };
  } catch (error) {
    console.error("Failed to export leads:", error);
    return { error: "Failed to export leads." };
  }
}
