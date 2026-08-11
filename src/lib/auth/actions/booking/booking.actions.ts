"use server";

import { revalidatePath } from "next/cache";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { PERMISSIONS } from "@/lib/auth/roles";
import { enforceBookingLimit } from "@/lib/billing/usage-enforcement";
import type { BookingEntity } from "@/lib/db/entities";
import * as bookingRepo from "@/lib/db/repositories/booking.repo";

export async function getWorkspaceBookings(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.BOOKINGS_MANAGE);

  try {
    const bookings = await bookingRepo.getWorkspaceBookings(workspaceId);
    return { success: true, bookings };
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    return { error: "Failed to load bookings.", bookings: [] };
  }
}

export async function updateBookingStatus(bookingId: string, status: BookingEntity["status"]) {
  try {
    const booking = await bookingRepo.getBookingById(bookingId);
    if (!booking) {
      return { error: "Booking not found." };
    }
    await requireWorkspaceAccess(booking.workspace, PERMISSIONS.BOOKINGS_MANAGE);

    await bookingRepo.updateBookingStatus(bookingId, status);
    revalidatePath("/dashboard/bookings");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to update booking:", error);
    return { error: "Failed to update booking." };
  }
}

export async function createBooking(data: {
  workspaceId: string;
  service?: string;
  date?: string;
  time?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  notes?: string;
}) {
  try {
    await requireWorkspaceAccess(data.workspaceId, PERMISSIONS.BOOKINGS_MANAGE);

    const limitCheck = await enforceBookingLimit(data.workspaceId);
    if (!limitCheck.allowed) {
      return { error: limitCheck.error ?? "Booking limit reached." };
    }

    const booking = await bookingRepo.createBooking({
      workspace: data.workspaceId,
      service: data.service,
      date: data.date,
      time: data.time,
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      customer_phone: data.customer_phone,
      notes: data.notes,
    });

    revalidatePath("/dashboard/bookings");
    return { success: true, booking };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to create booking:", error);
    return { error: "Failed to create booking." };
  }
}

export async function cancelBooking(bookingId: string) {
  try {
    const booking = await bookingRepo.getBookingById(bookingId);
    if (!booking) {
      return { error: "Booking not found." };
    }
    await requireWorkspaceAccess(booking.workspace, PERMISSIONS.BOOKINGS_MANAGE);

    await bookingRepo.cancelBooking(bookingId);
    revalidatePath("/dashboard/bookings");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized") || message.startsWith("Forbidden")) {
      return { error: message };
    }
    console.error("Failed to cancel booking:", error);
    return { error: "Failed to cancel booking." };
  }
}
