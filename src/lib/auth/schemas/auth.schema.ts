import { z } from "zod";

export const directusLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .max(256, "Email must be 256 characters or less."),
  password: z.string().min(1, "Password is required.").max(256, "Password must be 256 characters or less."),
});

export type DirectusLoginInput = z.infer<typeof directusLoginSchema>;

export const directusSignUpSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120, "Name must be 120 characters or less."),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .max(256, "Email must be 256 characters or less."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(256, "Password must be 256 characters or less."),
});

export type DirectusSignUpInput = z.infer<typeof directusSignUpSchema>;

export const supabaseLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .max(256, "Email must be 256 characters or less."),
  password: z.string().min(1, "Password is required.").max(256, "Password must be 256 characters or less."),
});

export type SupabaseLoginInput = z.infer<typeof supabaseLoginSchema>;

export const supabaseSignUpSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120, "Name must be 120 characters or less."),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .max(256, "Email must be 256 characters or less."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(256, "Password must be 256 characters or less."),
});

export type SupabaseSignUpInput = z.infer<typeof supabaseSignUpSchema>;
