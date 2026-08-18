import { db } from "../client";
import type { CustomerEntity } from "../entities";

export interface CustomerAggregate {
  id: string;
  workspace: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  stage: CustomerEntity["stage"];
  notes: string | null;
  totalConversations: number;
  totalBookings: number;
  lastContact: string;
  dateCreated: string;
}

export async function getWorkspaceCustomers(workspaceId: string): Promise<CustomerAggregate[]> {
  const [customers, conversations, bookings] = await Promise.all([
    db.customer.getByWorkspace(workspaceId),
    db.conversation.getByWorkspace(workspaceId),
    db.booking.getByWorkspace(workspaceId),
  ]);

  const convoCount = new Map<string, number>();
  const lastContact = new Map<string, string>();
  for (const convo of conversations) {
    if (!convo.customer) continue;
    convoCount.set(convo.customer, (convoCount.get(convo.customer) ?? 0) + 1);
    const current = lastContact.get(convo.customer);
    if (!current || convo.date_updated > current) {
      lastContact.set(convo.customer, convo.date_updated);
    }
  }

  const bookingCount = new Map<string, number>();
  for (const booking of bookings) {
    if (!booking.customer_email) continue;
    const owner = customers.find((c) => c.email.toLowerCase() === booking.customer_email.toLowerCase());
    if (!owner) continue;
    bookingCount.set(owner.id, (bookingCount.get(owner.id) ?? 0) + 1);
  }

  return customers.map((customer) => ({
    id: customer.id,
    workspace: customer.workspace,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    company: customer.company,
    stage: customer.stage,
    notes: customer.notes,
    totalConversations: convoCount.get(customer.id) ?? 0,
    totalBookings: bookingCount.get(customer.id) ?? 0,
    lastContact: lastContact.get(customer.id) ?? customer.date_created,
    dateCreated: customer.date_created,
  }));
}

export async function getCustomerById(id: string): Promise<CustomerEntity | null> {
  try {
    return await db.customer.getById(id);
  } catch {
    return null;
  }
}

export async function createCustomer(params: {
  workspace: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  stage?: CustomerEntity["stage"];
  notes?: string;
}): Promise<CustomerEntity> {
  return db.customer.create({
    workspace: params.workspace,
    name: params.name,
    email: params.email,
    phone: params.phone ?? null,
    company: params.company ?? null,
    stage: params.stage ?? "lead",
    notes: params.notes ?? null,
  });
}

export async function deleteCustomer(id: string): Promise<void> {
  await db.customer.delete(id);
}
