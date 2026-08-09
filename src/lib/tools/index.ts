import { z } from "zod";

import { toolRegistry } from "./registry";
import type { ToolContext } from "./registry";

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
    async execute(args: { name: string; email: string; phone?: string; company?: string; message?: string }, _context: ToolContext) {
      return {
        success: true,
        data: {
          message: `Lead captured for ${args.name} (${args.email}). The team will follow up soon.`,
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
    async execute(args: { name: string; email: string; phone?: string; company?: string }, _context: ToolContext) {
      return {
        success: true,
        data: {
          message: `Customer record created for ${args.name}.`,
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
    async execute(_args: { email: string }, _context: ToolContext) {
      return {
        success: true,
        data: {
          found: false,
          message: "No existing customer found with that email.",
        },
      };
    },
  });

  // Booking tools
  toolRegistry.register({
    name: "check_availability",
    description:
      "Check available time slots for a service on a given date. Use when a customer wants to book an appointment.",
    parameters: z.object({
      service: z.string().trim().min(1).max(128),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    async execute(args: { service: string; date: string }, _context: ToolContext) {
      const slots = ["09:00", "10:30", "13:00", "14:30", "16:00"];
      return {
        success: true,
        data: {
          date: args.date,
          service: args.service,
          availableSlots: slots,
          message: `Available times for ${args.service} on ${args.date}: ${slots.join(", ")}. Which time works for you?`,
        },
      };
    },
  });

  toolRegistry.register({
    name: "create_booking",
    description:
      "Create a new booking. Use after the customer chooses a time from check_availability.",
    parameters: z.object({
      service: z.string().trim().min(1).max(128),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      customerName: z.string().trim().min(1).max(128),
      customerEmail: z.string().trim().email().max(256),
      customerPhone: z.string().trim().max(20).optional(),
    }),
    async execute(args: { service: string; date: string; time: string; customerName: string; customerEmail: string; customerPhone?: string }, _context: ToolContext) {
      return {
        success: true,
        data: {
          message: `Booking confirmed! ${args.customerName} is scheduled for ${args.service} on ${args.date} at ${args.time}.`,
        },
      };
    },
  });

  toolRegistry.register({
    name: "cancel_booking",
    description: "Cancel an existing booking.",
    parameters: z.object({
      bookingId: z.string().min(1),
    }),
    async execute(args: { bookingId: string }, _context: ToolContext) {
      return {
        success: true,
        data: {
          message: `Booking has been cancelled.`,
        },
      };
    },
  });

  toolRegistry.register({
    name: "reschedule_booking",
    description: "Reschedule an existing booking to a new date/time.",
    parameters: z.object({
      bookingId: z.string().min(1),
      newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      newTime: z.string().regex(/^\d{2}:\d{2}$/),
    }),
    async execute(args: { bookingId: string; newDate: string; newTime: string }, _context: ToolContext) {
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
    async execute(_args: { reason?: string }, _context: ToolContext) {
      return {
        success: true,
        data: {
          message:
            "I'll connect you with a human agent right away. Someone will be with you shortly.",
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
    async execute(args: { name: string; email: string; subject: string; message: string }, _context: ToolContext) {
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
