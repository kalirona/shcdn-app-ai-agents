import { z } from "zod";

import { toolRegistry } from "./registry";
import type { ToolContext } from "./registry";
import { db } from "@/lib/db/client";
import type { BookingEntity } from "@/lib/db/entities";

function getBusinessHoursForDate(dateStr: string): { start: string; end: string }[] {
  const date = new Date(dateStr + "T00:00:00");
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Acme Dental hours from knowledge base:
  // Monday-Friday: 9 AM - 5 PM
  // Saturday: 10 AM - 2 PM
  // Sunday: Closed

  if (dayOfWeek === 0) return []; // Sunday closed
  if (dayOfWeek === 6) return [{ start: "10:00", end: "14:00" }]; // Saturday
  return [{ start: "09:00", end: "17:00" }]; // Monday-Friday
}

function generateTimeSlots(start: string, end: string, intervalMinutes = 30): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);

  let currentHour = startHour;
  let currentMin = startMin;

  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    slots.push(`${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`);
    currentMin += intervalMinutes;
    if (currentMin >= 60) {
      currentHour += Math.floor(currentMin / 60);
      currentMin %= 60;
    }
  }

  return slots;
}

export function registerAllTools(): void {
  // Lead tools
  toolRegistry.register({
    name: "capture_lead",
    description:
      "Capture a new lead from a customer. Use when the customer expresses interest in your services, wants a quote, or provides contact information.",
    parameters: z.object({
      name: z.string().trim().min(1).max(128),
      email: z.string().trim().email().max(256),
      phone: z.string().trim().max(20).optional(),
      company: z.string().trim().max(128).optional(),
      message: z.string().trim().max(2000).optional(),
    }),
    async execute(args: { name: string; email: string; phone?: string; company?: string; message?: string }, context: ToolContext) {
      const { createLead } = await import("@/lib/db/repositories/lead.repo");
      const lead = await createLead({
        workspace: context.workspaceId,
        name: args.name,
        email: args.email,
        phone: args.phone,
        company: args.company,
        message: args.message,
        source: "widget",
      });
      return {
        success: true,
        data: {
          message: `Lead captured for ${args.name} (${args.email}). The team will follow up soon.`,
          leadId: lead.id,
        },
      };
    },
  });

  // Customer tools
  toolRegistry.register({
    name: "create_customer",
    description: "Create a new customer record in the CRM.",
    parameters: z.object({
      name: z.string().trim().min(1).max(128),
      email: z.string().trim().email().max(256),
      phone: z.string().trim().max(20).optional(),
      company: z.string().trim().max(128).optional(),
    }),
    async execute(args: { name: string; email: string; phone?: string; company?: string }, context: ToolContext) {
      const { createCustomer } = await import("@/lib/db/repositories/customer.repo");
      const customer = await createCustomer({
        workspace: context.workspaceId,
        name: args.name,
        email: args.email,
        phone: args.phone,
        company: args.company,
      });
      return {
        success: true,
        data: {
          message: `Customer record created for ${args.name}.`,
          customerId: customer.id,
        },
      };
    },
  });

  toolRegistry.register({
    name: "get_customer",
    description: "Look up a customer by email address.",
    parameters: z.object({
      email: z.string().trim().email(),
    }),
    async execute(args: { email: string }, context: ToolContext) {
      const customers = await db.customer.getByWorkspace(context.workspaceId);
      const customer = customers.find((c) => c.email.toLowerCase() === args.email.toLowerCase());
      if (!customer) {
        return {
          success: true,
          data: {
            found: false,
            message: "No existing customer found with that email.",
          },
        };
      }
      return {
        success: true,
        data: {
          found: true,
          customerId: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          company: customer.company,
          stage: customer.stage,
        },
      };
    },
  });

  // Booking tools
  toolRegistry.register({
    name: "check_availability",
    description:
      "Check available time slots for a service on a given date. Use when a customer wants to book an appointment. Returns real availability based on existing bookings and business hours. Date MUST be in YYYY-MM-DD format (e.g., 2026-08-17).",
    parameters: z.object({
      service: z.string().trim().min(1).max(128),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date in YYYY-MM-DD format (e.g., 2026-08-17). Use current date reference from system prompt."),
    }),
    async execute(args: { service: string; date: string }, context: ToolContext) {
      // Get existing bookings for this workspace and date
      const allBookings = await db.booking.getByWorkspace(context.workspaceId);
      const dayBookings = allBookings.filter(
        (b) => b.date === args.date && b.status === "confirmed",
      );

      // Get booked times for this date
      const bookedTimes = new Set(dayBookings.map((b) => b.time));

      // Get business hours for this date
      const hours = getBusinessHoursForDate(args.date);
      if (hours.length === 0) {
        return {
          success: true,
          data: {
            date: args.date,
            service: args.service,
            availableSlots: [],
            message: `We are closed on ${args.date}. Please choose a different date.`,
          },
        };
      }

      // Generate all possible slots
      const allSlots: string[] = [];
      for (const h of hours) {
        const slots = generateTimeSlots(h.start, h.end, 30);
        allSlots.push(...slots);
      }

      // Filter out booked slots
      const availableSlots = allSlots.filter((slot) => !bookedTimes.has(slot));

      return {
        success: true,
        data: {
          date: args.date,
          service: args.service,
          availableSlots,
          message:
            availableSlots.length > 0
              ? `Available times for ${args.service} on ${args.date}: ${availableSlots.join(", ")}. Which time works for you?`
              : `No available times for ${args.service} on ${args.date}. Please choose a different date or time.`,
        },
      };
    },
  });

  toolRegistry.register({
    name: "create_booking",
    description:
      "Create a new booking. Use after the customer chooses a time from check_availability. Validates the slot is available and creates the booking in the system. Date MUST be YYYY-MM-DD, time MUST be HH:MM (24-hour).",
    parameters: z.object({
      service: z.string().trim().min(1).max(128),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date in YYYY-MM-DD format (e.g., 2026-08-17)"),
      time: z.string().regex(/^\d{2}:\d{2}$/).describe("Time in HH:MM 24-hour format (e.g., 14:30 for 2:30 PM)"),
      customerName: z.string().trim().min(1).max(128),
      customerEmail: z.string().trim().email().max(256),
      customerPhone: z.string().trim().max(20).optional(),
    }),
    async execute(
      args: { service: string; date: string; time: string; customerName: string; customerEmail: string; customerPhone?: string },
      context: ToolContext,
    ) {
      // Verify the slot is available
      const allBookings = await db.booking.getByWorkspace(context.workspaceId);
      const conflictingBooking = allBookings.find(
        (b) =>
          b.date === args.date &&
          b.time === args.time &&
          b.status === "confirmed",
      );

      if (conflictingBooking) {
        return {
          success: false,
          error: `The time slot ${args.time} on ${args.date} is already booked. Please choose a different time.`,
        };
      }

      // Check if within business hours
      const hours = getBusinessHoursForDate(args.date);
      const isWithinHours = hours.some((h) => {
        const start = h.start;
        const end = h.end;
        return args.time >= start && args.time < end;
      });

      if (!isWithinHours) {
        return {
          success: false,
          error: `The time ${args.time} is outside business hours on ${args.date}.`,
        };
      }

      // Create or find customer
      let customer = await db.customer.getByWorkspace(context.workspaceId);
      let existingCustomer = customer.find((c) => c.email.toLowerCase() === args.customerEmail.toLowerCase());

      if (!existingCustomer) {
        existingCustomer = await db.customer.create({
          workspace: context.workspaceId,
          name: args.customerName,
          email: args.customerEmail,
          phone: args.customerPhone ?? null,
          company: null,
          stage: "customer",
          notes: `Created via booking for ${args.service}`,
        });
      }

      // Create the booking
      const booking = await db.booking.create({
        workspace: context.workspaceId,
        service: args.service,
        date: args.date,
        time: args.time,
        customer_name: args.customerName,
        customer_email: args.customerEmail,
        customer_phone: args.customerPhone ?? null,
        notes: `Booked via AI agent ${context.agentId}`,
        status: "confirmed",
      });

      return {
        success: true,
        data: {
          message: `Booking confirmed! ${args.customerName} is scheduled for ${args.service} on ${args.date} at ${args.time}.`,
          bookingId: booking.id,
          booking,
        },
      };
    },
  });

  toolRegistry.register({
    name: "get_business_hours",
    description: "Get the business hours and timezone for the current workspace. Uses knowledge base to find business hours information.",
    parameters: z.object({}),
    async execute(_args: {}, context: ToolContext) {
      // The business hours are typically stored in the knowledge base.
      // The AI should use RAG to retrieve this information.
      return {
        success: true,
        data: {
          message: "Business hours and timezone information is available in the knowledge base. Please ask me about business hours and I'll look it up for you."
        },
      };
    },
  });

  toolRegistry.register({
    name: "cancel_booking",
    description: "Cancel an existing booking. Can be identified by booking ID, or by customer email/name with date.",
    parameters: z.object({
      bookingId: z.string().min(1).optional(),
      customerEmail: z.string().trim().email().optional(),
      customerName: z.string().trim().min(1).max(128).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    }).refine(data => data.bookingId || (data.customerEmail && data.date), {
      message: "Either bookingId, or customerEmail with date must be provided",
    }),
    async execute(args: { bookingId?: string; customerEmail?: string; customerName?: string; date?: string; time?: string }, context: ToolContext) {
      let booking = null;
      
      if (args.bookingId) {
        booking = await db.booking.getById(args.bookingId);
      } else if (args.customerEmail && args.date) {
        const allBookings = await db.booking.getByWorkspace(context.workspaceId);
        booking = allBookings.find(
          (b) => b.customer_email.toLowerCase() === args.customerEmail!.toLowerCase() &&
                 b.date === args.date &&
                 (args.time ? b.time === args.time : true) &&
                 b.status === "confirmed",
        );
      } else if (args.customerName && args.date) {
        const allBookings = await db.booking.getByWorkspace(context.workspaceId);
        booking = allBookings.find(
          (b) => b.customer_name.toLowerCase() === args.customerName!.toLowerCase() &&
                 b.date === args.date &&
                 (args.time ? b.time === args.time : true) &&
                 b.status === "confirmed",
        );
      }

      if (!booking) {
        return {
          success: false,
          error: "Booking not found. Please provide booking ID, or customer email/name with date.",
        };
      }

      if (booking.workspace !== context.workspaceId) {
        return {
          success: false,
          error: "Unauthorized: booking belongs to a different workspace.",
        };
      }

      if (booking.status === "cancelled") {
        return {
          success: false,
          error: "Booking is already cancelled.",
        };
      }

      await db.booking.update(booking.id, { status: "cancelled" });

      return {
        success: true,
        data: {
          message: `Booking ${booking.id} (${booking.date} at ${booking.time}) has been cancelled.`,
          bookingId: booking.id,
        },
      };
    },
  });

  toolRegistry.register({
    name: "reschedule_booking",
    description: "Reschedule an existing booking to a new date/time. Can identify booking by ID, or by customer email/name with current date/time. Validates the new slot is available. Dates MUST be YYYY-MM-DD, times MUST be HH:MM (24-hour).",
    parameters: z.object({
      bookingId: z.string().min(1).optional(),
      customerEmail: z.string().trim().email().optional(),
      customerName: z.string().trim().min(1).max(128).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Current booking date in YYYY-MM-DD format"),
      time: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("Current booking time in HH:MM 24-hour format"),
      newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("New date in YYYY-MM-DD format (e.g., 2026-08-17)"),
      newTime: z.string().regex(/^\d{2}:\d{2}$/).describe("New time in HH:MM 24-hour format (e.g., 15:00 for 3:00 PM)"),
    }).refine(data => data.bookingId || (data.customerEmail && data.date), {
      message: "Either bookingId, or customerEmail with current date must be provided",
    }),
    async execute(args: { bookingId?: string; customerEmail?: string; customerName?: string; date?: string; time?: string; newDate: string; newTime: string }, context: ToolContext) {
      let booking = null;
      
      if (args.bookingId) {
        booking = await db.booking.getById(args.bookingId);
      } else if (args.customerEmail && args.date) {
        const allBookings = await db.booking.getByWorkspace(context.workspaceId);
        booking = allBookings.find(
          (b) => b.customer_email.toLowerCase() === args.customerEmail!.toLowerCase() &&
                 b.date === args.date &&
                 (args.time ? b.time === args.time : true) &&
                 b.status === "confirmed",
        );
      } else if (args.customerName && args.date) {
        const allBookings = await db.booking.getByWorkspace(context.workspaceId);
        booking = allBookings.find(
          (b) => b.customer_name.toLowerCase() === args.customerName!.toLowerCase() &&
                 b.date === args.date &&
                 (args.time ? b.time === args.time : true) &&
                 b.status === "confirmed",
        );
      }

      if (!booking) {
        return {
          success: false,
          error: "Booking not found. Please provide booking ID, or customer email/name with current date.",
        };
      }

      if (booking.workspace !== context.workspaceId) {
        return {
          success: false,
          error: "Unauthorized: booking belongs to a different workspace.",
        };
      }

      if (booking.status === "cancelled") {
        return {
          success: false,
          error: "Cannot reschedule a cancelled booking.",
        };
      }

      // Check new slot availability
      const allBookings = await db.booking.getByWorkspace(context.workspaceId);
      const conflictingBooking = allBookings.find(
        (b) =>
          b.id !== args.bookingId &&
          b.date === args.newDate &&
          b.time === args.newTime &&
          b.status === "confirmed",
      );

      if (conflictingBooking) {
        return {
          success: false,
          error: `The time slot ${args.newTime} on ${args.newDate} is already booked. Please choose a different time.`,
        };
      }

      // Check new time is within business hours
      const hours = getBusinessHoursForDate(args.newDate);
      const isWithinHours = hours.some((h) => {
        const start = h.start;
        const end = h.end;
        return args.newTime >= start && args.newTime < end;
      });

      if (!isWithinHours) {
        return {
          success: false,
          error: `The time ${args.newTime} is outside business hours on ${args.newDate}.`,
        };
      }

      // Update booking
      await db.booking.update(booking.id, {
        date: args.newDate,
        time: args.newTime,
        status: "rescheduled",
      });

      return {
        success: true,
        data: {
          message: `Booking rescheduled to ${args.newDate} at ${args.newTime}.`,
        },
      };
    },
  });

  // Contact tools
  toolRegistry.register({
    name: "request_human",
    description:
      "Request a human agent to take over. Use when the customer explicitly asks for a human, seems frustrated, or the issue is too complex.",
    parameters: z.object({
      reason: z.string().max(500).optional(),
    }),
    async execute(_args: { reason?: string }, context: ToolContext) {
      // Update conversation status to human_required
      if (context.conversationId) {
        await db.conversation.update(context.conversationId, {
          status: "human_required",
          handoff_trigger: "explicit_request",
          handoff_reason: "Customer requested human agent",
        });
        await db.message.create({
          conversation: context.conversationId,
          role: "system",
          content: "Conversation transferred to human support.",
          sources: null,
          metadata: { handoffTrigger: "explicit_request", handoffReason: "Customer requested human agent" },
        });
      }
      return {
        success: true,
        data: {
          message: "I'll connect you with a human agent right away. Someone will be with you shortly.",
        },
      };
    },
  });

  toolRegistry.register({
    name: "send_contact_request",
    description: "Send a contact request to the business team.",
    parameters: z.object({
      name: z.string().trim().min(1).max(128),
      email: z.string().trim().email().max(256),
      subject: z.string().trim().min(1).max(200),
      message: z.string().trim().min(1).max(2000),
    }),
    async execute(args: { name: string; email: string; subject: string; message: string }, context: ToolContext) {
      // Create a lead for the contact request
      const { createLead } = await import("@/lib/db/repositories/lead.repo");
      await createLead({
        workspace: context.workspaceId,
        name: args.name,
        email: args.email,
        message: `Subject: ${args.subject}\n\n${args.message}`,
        source: "contact_form",
      });
      return {
        success: true,
        data: {
          message: `Your message has been sent. The team will respond to ${args.email} within 24 hours.`,
        },
      };
    },
  });
}

export { toolRegistry } from "./registry";
export type { ToolDefinition, ToolContext, ToolResult, ToolCall } from "./registry";