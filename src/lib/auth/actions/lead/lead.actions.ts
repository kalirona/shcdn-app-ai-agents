"use server";

import { revalidatePath } from "next/cache";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { PERMISSIONS } from "@/lib/auth/roles";
import type { LeadEntity } from "@/lib/db/entities";

export async function getWorkspaceLeads(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.LEADS_READ);

  try {
    // TODO: Fetch from Directus
    // const leads = await leadRepo.getByWorkspace(workspaceId);
    const leads: LeadEntity[] = [];
    return { success: true, leads };
  } catch (error) {
    console.error("Failed to fetch leads:", error);
    return { error: "Failed to load leads.", leads: [] };
  }
}

export async function updateLeadStatus(leadId: string, status: LeadEntity["status"]) {
  try {
    // TODO: Update in Directus
    // await leadRepo.updateStatus(leadId, status);
    revalidatePath("/dashboard/leads");
    return { success: true };
  } catch (error) {
    console.error("Failed to update lead status:", error);
    return { error: "Failed to update lead status." };
  }
}

export async function exportLeads(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.LEADS_MANAGE);

  try {
    // TODO: Fetch from Directus
    // const leads = await leadRepo.getByWorkspace(workspaceId);
    const leads: LeadEntity[] = [];

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
