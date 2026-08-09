"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Check,
  DollarSign,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getQuotesFromStorage, saveQuoteToStorage } from "@/lib/db/crm-storage";

interface Quote {
  id: string;
  customerName: string;
  customerEmail: string;
  items: Array<{ description: string; quantity: number; price: number }>;
  status: "draft" | "sent" | "accepted" | "rejected";
  total: number;
  dateCreated: string;
  validUntil: string;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuotes(getQuotesFromStorage());
    setIsLoading(false);
  }, []);

  function handleCreate() {
    setOpen(false);
    toast.success("Quote created!");
    setQuotes(getQuotesFromStorage());
  }

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
          <h1 className="font-semibold text-2xl tracking-tight">Quotes</h1>
          <p className="text-muted-foreground">Create and manage quotes for your customers.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus />
              New Quote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Quote</DialogTitle>
              <DialogDescription>Generate a new quote for your customer.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const quote: Quote = {
                  id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                  customerName: formData.get("customerName") as string,
                  customerEmail: formData.get("customerEmail") as string,
                  items: [
                    {
                      description: formData.get("itemDescription") as string,
                      quantity: Number(formData.get("itemQuantity")),
                      price: Number(formData.get("itemPrice")),
                    },
                  ],
                  status: "draft",
                  total: Number(formData.get("itemQuantity")) * Number(formData.get("itemPrice")),
                  dateCreated: new Date().toISOString(),
                  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                };
                saveQuoteToStorage(quote);
                handleCreate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input id="customerName" name="customerName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Customer Email</Label>
                <Input id="customerEmail" name="customerEmail" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itemDescription">Item Description</Label>
                <Input id="itemDescription" name="itemDescription" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="itemQuantity">Quantity</Label>
                  <Input id="itemQuantity" name="itemQuantity" type="number" min="1" defaultValue="1" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="itemPrice">Price ($)</Label>
                  <Input id="itemPrice" name="itemPrice" type="number" min="0" step="0.01" required />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Quote</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-16">
          <DollarSign className="size-12 text-muted-foreground" />
          <h3 className="mt-4 font-semibold text-lg">No quotes yet</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            Create quotes for your customers and track their status.
          </p>
          <Button className="mt-4" onClick={() => setOpen(true)}>
            <Plus />
            Create First Quote
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-sm">Quote</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Total</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Status</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Valid Until</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id} className="border-b transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium">Quote #{quote.id.slice(-6)}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{quote.customerName}</p>
                    <p className="text-muted-foreground text-xs">{quote.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">${quote.total.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                        quote.status === "accepted"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : quote.status === "rejected"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : quote.status === "sent"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {quote.status === "accepted" && <Check className="mr-1 size-3" />}
                      {quote.status === "rejected" && <X className="mr-1 size-3" />}
                      <span className="capitalize">{quote.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(quote.validUntil).toLocaleDateString()}
                    </span>
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
