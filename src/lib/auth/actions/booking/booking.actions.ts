"use server";

import { revalidatePath } from "next/cache";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { PERMISSIONS } from "@/lib/auth/roles";
import type { BookingEntity } from "@/lib/db/entities";

export async function getWorkspaceBookings(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId, PERMISSIONS.BOOKINGS_MANAGE);

  try {
    // TODO: Fetch from Directus
    // const bookings = await bookingRepo.getByWorkspace(workspaceId);
    const bookings: BookingEntity[] = [];
    return { success: true, bookings };
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    return { error: "Failed to load bookings.", bookings: [] };
  }
}

export async function updateBookingStatus(bookingId: string, status: BookingEntity["status"]) {
  try {
    // TODO: Update in Directus
    // await bookingRepo.updateStatus(bookingId, status);
    revalidatePath("/dashboard/bookings");
    return { success: true };
  } catch (error) {
    console.error("Failed to update booking:", error);
    return { error: "Failed to update booking." };
  }
}

export async function createBooking(data: Omit<BookingEntity, "id" | "date_created" | "date_updated">) {
  try {
    // TODO: Store in Directus
    // const booking = await bookingRepo.create(data);
    revalidatePath("/dashboard/bookings");
    return { success: true };
  } catch (error) {
    console.error("Failed to create booking:", error);
    return { error: "Failed to create booking." };
  }
}

export async function cancelBooking(bookingId: string) {
  try {
    // TODO: Update in Directus
    // await bookingRepo.updateStatus(bookingId, "cancelled");
    revalidatePath("/dashboard/bookings");
    return { success: true };
  } catch (error) {
    console.error("Failed to cancel booking:", error);
    return { error: "Failed to cancel booking." };
  }
}
