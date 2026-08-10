export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  stage: "anonymous" | "lead" | "customer";
  conversations: string[];
  leads: string[];
  bookings: string[];
  notes: string | null;
  totalConversations: number;
  totalBookings: number;
  totalValue: number;
  lastContact: string;
  dateCreated: string;
}

export interface Lead {
  id: string;
  workspace: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: string | null;
  status: "new" | "contacted" | "qualified" | "won" | "lost";
  qualification: Record<string, string>;
  dateCreated: string;
}

export interface Quote {
  id: string;
  customerName: string;
  customerEmail: string;
  items: Array<{ description: string; quantity: number; price: number }>;
  status: "draft" | "sent" | "accepted" | "rejected";
  total: number;
  dateCreated: string;
  validUntil: string;
}

const CUSTOMERS_KEY = "agent_ai_customers";
const QUOTES_KEY = "agent_ai_quotes";
const LEADS_KEY = "agent_ai_leads";

function getStore<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStore<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

export function getCustomersFromStorage(): Customer[] {
  return getStore<Customer>(CUSTOMERS_KEY);
}

export function saveCustomerToStorage(customer: Customer): void {
  const customers = getCustomersFromStorage();
  const idx = customers.findIndex((c) => c.id === customer.id);
  if (idx >= 0) {
    customers[idx] = customer;
  } else {
    customers.push(customer);
  }
  setStore(CUSTOMERS_KEY, customers);
}

export function deleteCustomerFromStorage(customerId: string): void {
  const customers = getCustomersFromStorage().filter((c) => c.id !== customerId);
  setStore(CUSTOMERS_KEY, customers);
}

export function getQuotesFromStorage(): Quote[] {
  return getStore<Quote>(QUOTES_KEY);
}

export function saveQuoteToStorage(quote: Quote): void {
  const quotes = getQuotesFromStorage();
  const idx = quotes.findIndex((q) => q.id === quote.id);
  if (idx >= 0) {
    quotes[idx] = quote;
  } else {
    quotes.push(quote);
  }
  setStore(QUOTES_KEY, quotes);
}

export function deleteQuoteFromStorage(quoteId: string): void {
  const quotes = getQuotesFromStorage().filter((q) => q.id !== quoteId);
  setStore(QUOTES_KEY, quotes);
}

export function getLeadsFromStorage(): Lead[] {
  return getStore<Lead>(LEADS_KEY);
}

export function getLeadsByWorkspace(workspaceId: string): Lead[] {
  return getLeadsFromStorage().filter((l) => l.workspace === workspaceId);
}

export function saveLeadToStorage(lead: Lead): void {
  const leads = getLeadsFromStorage();
  const idx = leads.findIndex((l) => l.id === lead.id);
  if (idx >= 0) {
    leads[idx] = lead;
  } else {
    leads.push(lead);
  }
  setStore(LEADS_KEY, leads);
}

export function deleteLeadFromStorage(leadId: string): void {
  const leads = getLeadsFromStorage().filter((l) => l.id !== leadId);
  setStore(LEADS_KEY, leads);
}

export function getLeadByEmail(email: string): Lead | null {
  return getLeadsFromStorage().find((l) => l.email === email) ?? null;
}
