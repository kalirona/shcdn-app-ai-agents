export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  totalConversations: number;
  totalBookings: number;
  totalValue: number;
  lastContact: string;
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
