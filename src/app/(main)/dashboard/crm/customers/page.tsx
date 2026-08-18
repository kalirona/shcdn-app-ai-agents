"use client";

import { useEffect, useState } from "react";

import { Loader2, Mail, MessageSquare, Phone, User } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getWorkspaceCustomers } from "@/lib/auth/actions/crm/customer.actions";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";
import type { CustomerAggregate } from "@/lib/db/repositories/customer.repo";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerAggregate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadCustomers = async () => {
      try {
        const user = await getCurrentUser();
        const ws = user.currentWorkspace;
        if (!ws) {
          return;
        }
        const result = await getWorkspaceCustomers(ws.id);
        if (!cancelled && result.customers) {
          setCustomers(result.customers);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadCustomers();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your customer relationships.</p>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-16">
          <User className="size-12 text-muted-foreground" />
          <h3 className="mt-4 font-semibold text-lg">No customers yet</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            Customers are automatically created when leads are captured by your AI agents.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-sm">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Conversations</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Bookings</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Last Contact</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">{customer.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{customer.name}</p>
                        {customer.company && <p className="text-muted-foreground text-xs">{customer.company}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 text-sm">
                        <Mail className="size-3 text-muted-foreground" />
                        {customer.email}
                      </p>
                      {customer.phone && (
                        <p className="flex items-center gap-1 text-muted-foreground text-xs">
                          <Phone className="size-3" />
                          {customer.phone}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="size-3 text-muted-foreground" />
                      {customer.totalConversations}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{customer.totalBookings}</td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {new Date(customer.lastContact).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
