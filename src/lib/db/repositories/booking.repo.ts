import { dispatchWebhook } from "@/lib/webhooks/delivery";

import { db } from "../client";
import type { BookingEntity } from "../entities";

export interface CreateBookingParams {
  workspace: string;
  service?: string;
  date?: string;
  time?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  notes?: string;
  status?: BookingEntity["status"];
}

export async function createBooking(params: CreateBookingParams): Promise<BookingEntity> {
  const booking = await db.booking.create({
    workspace: params.workspace,
    service: params.service ?? null,
    date: params.date ?? null,
    time: params.time ?? null,
    customer_name: params.customer_name,
    customer_email: params.customer_email,
    customer_phone: params.customer_phone ?? null,
    notes: params.notes ?? null,
    status: params.status ?? "confirmed",
  });

  await dispatchWebhook(params.workspace, "booking.created", { booking });
  return booking;
}

export async function getWorkspaceBookings(workspaceId: string): Promise<BookingEntity[]> {
  return db.booking.getByWorkspace(workspaceId);
}

export async function getBookingById(id: string): Promise<BookingEntity | null> {
  try {
    return await db.booking.getById(id);
  } catch {
    return null;
  }
}

export async function updateBookingStatus(id: string, status: BookingEntity["status"]): Promise<BookingEntity> {
  const booking = await db.booking.update(id, { status });
  if (status === "cancelled") {
    await dispatchWebhook(booking.workspace, "booking.cancelled", { booking });
  } else if (status === "rescheduled") {
    await dispatchWebhook(booking.workspace, "booking.rescheduled", { booking });
  }
  return booking;
}

export async function cancelBooking(id: string): Promise<BookingEntity> {
  const booking = await db.booking.update(id, { status: "cancelled" });
  await dispatchWebhook(booking.workspace, "booking.cancelled", { booking });
  return booking;
}
