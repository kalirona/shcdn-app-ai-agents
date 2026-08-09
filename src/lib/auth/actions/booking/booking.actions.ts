"use server";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/auth-context";
import type { BookingEntity } from "@/lib/db/entities";

async function requireAuth() {
  const { isAuthenticated, user } = await getAuthContext();
  if (!isAuthenticated || !user) {
    throw new Error("Unauthorized: You must be logged in.");
  }
  return user;
}

export async function getWorkspaceBookings(workspaceId: string) {
  await requireAuth();

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
  await requireAuth();

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
  await requireAuth();

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
  await requireAuth();

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
