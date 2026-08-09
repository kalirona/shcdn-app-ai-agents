import { z } from "zod";

export const toolCallSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
});

export const toolResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

export const leadCaptureSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(128),
  email: z.string().trim().email("Valid email is required.").max(256),
  phone: z.string().trim().max(20).optional(),
  company: z.string().trim().max(128).optional(),
  message: z.string().trim().max(2000).optional(),
  source: z.string().max(128).optional(),
});

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1).max(128),
  email: z.string().trim().email().max(256),
  phone: z.string().trim().max(20).optional(),
  company: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const bookingCheckSchema = z.object({
  service: z.string().trim().min(1).max(128),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
});

export const bookingCreateSchema = z.object({
  service: z.string().trim().min(1).max(128),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM."),
  customerName: z.string().trim().min(1).max(128),
  customerEmail: z.string().trim().email().max(256),
  customerPhone: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const contactRequestSchema = z.object({
  name: z.string().trim().min(1).max(128),
  email: z.string().trim().email().max(256),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
});

export type LeadCaptureInput = z.infer<typeof leadCaptureSchema>;
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type BookingCheckInput = z.infer<typeof bookingCheckSchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type ContactRequestInput = z.infer<typeof contactRequestSchema>;
