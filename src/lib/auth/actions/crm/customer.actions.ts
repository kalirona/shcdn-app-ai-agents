"use server";

import { revalidatePath } from "next/cache";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { PERMISSIONS } from "@/lib/auth/roles";
import type { CustomerEntity } from "@/lib/db/entities";
import * as customerRepo from "@/lib/db/repositories/customer.repo";

export async function getWorkspaceCustomers(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.CUSTOMERS_READ);

  try {
    const customers = await customerRepo.getWorkspaceCustomers(workspaceId);
    return { success: true, customers };
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return { error: "Failed to load customers.", customers: [] };
  }
}

export async function deleteCustomer(customerId: string) {
  try {
    const customer = await customerRepo.getCustomerById(customerId);
    if (!customer) {
      return { error: "Customer not found." };
    }
    await requireWorkspaceAccess(customer.workspace, PERMISSIONS.CUSTOMERS_READ);

    await customerRepo.deleteCustomer(customerId);
    revalidatePath("/dashboard/crm/customers");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to delete customer:", error);
    return { error: "Failed to delete customer." };
  }
}

export async function createCustomer(data: {
  workspaceId: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  stage?: CustomerEntity["stage"];
}) {
  try {
    await requireWorkspaceAccess(data.workspaceId, PERMISSIONS.CUSTOMERS_READ);

    const customer = await customerRepo.createCustomer({
      workspace: data.workspaceId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      stage: data.stage,
    });

    revalidatePath("/dashboard/crm/customers");
    return { success: true, customer };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to create customer:", error);
    return { error: "Failed to create customer." };
  }
}
