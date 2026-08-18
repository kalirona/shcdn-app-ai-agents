"use client";

import { useEffect, useState } from "react";

import { Calendar, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getWorkspaceBookings, updateBookingStatus } from "@/lib/auth/actions/booking/booking.actions";
import { getCurrentUser } from "@/lib/auth/actions/user.actions";
import type { BookingEntity } from "@/lib/db/entities";

const STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed", color: "border-green-200 bg-green-50 text-green-700" },
  { value: "completed", label: "Completed", color: "border-blue-200 bg-blue-50 text-blue-700" },
  { value: "cancelled", label: "Cancelled", color: "border-red-200 bg-red-50 text-red-700" },
  { value: "rescheduled", label: "Rescheduled", color: "border-yellow-200 bg-yellow-50 text-yellow-700" },
];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadBookings = async () => {
      try {
        const user = await getCurrentUser();
        const ws = user.currentWorkspace;
        if (!ws) {
          return;
        }
        const result = await getWorkspaceBookings(ws.id);
        if (!cancelled) {
          setBookings(result.bookings);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadBookings();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStatusChange(bookingId: string, newStatus: BookingEntity["status"]) {
    const result = await updateBookingStatus(bookingId, newStatus);
    if (result.error) {
      toast.error(result.error);
    } else {
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b)));
      toast.success("Booking updated.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Bookings</h1>
        <p className="text-muted-foreground">Manage appointments booked through your AI agents.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!isLoading && bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Calendar className="size-12 text-muted-foreground" />
          <h3 className="mt-4 font-semibold text-lg">No bookings yet</h3>
          <p className="mt-1 text-muted-foreground text-sm">Appointments booked by your AI agents will appear here.</p>
        </div>
      ) : null}

      {!isLoading && bookings.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-sm">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Service</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Date & Time</th>
                <th className="px-4 py-3 text-left font-medium text-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{booking.customer_name}</p>
                      <p className="text-muted-foreground text-xs">{booking.customer_email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{booking.service}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="size-3 text-muted-foreground" />
                      {booking.date}
                      <Clock className="size-3 text-muted-foreground" />
                      {booking.time}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={booking.status}
                      onValueChange={(v) => handleStatusChange(booking.id, v as BookingEntity["status"])}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
