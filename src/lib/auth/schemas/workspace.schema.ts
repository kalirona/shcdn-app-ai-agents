import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters.")
    .max(64, "Workspace name must be 64 characters or less.")
    .regex(/^[a-zA-Z0-9\s\-_]+$/, "Only letters, numbers, spaces, hyphens, and underscores allowed."),
  description: z.string().trim().max(500, "Description must be 500 characters or less.").optional(),
  website: z
    .string()
    .trim()
    .url("Please enter a valid URL.")
    .max(256, "URL must be 256 characters or less.")
    .optional()
    .or(z.literal("")),
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters.")
    .max(64, "Workspace name must be 64 characters or less.")
    .regex(/^[a-zA-Z0-9\s\-_]+$/, "Only letters, numbers, spaces, hyphens, and underscores allowed.")
    .optional(),
  description: z.string().trim().max(500, "Description must be 500 characters or less.").optional(),
  website: z
    .string()
    .trim()
    .url("Please enter a valid URL.")
    .max(256, "URL must be 256 characters or less.")
    .optional()
    .or(z.literal("")),
});

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .max(256, "Email must be 256 characters or less."),
  role: z.enum(["admin", "member"], {
    message: "Role must be either admin or member.",
  }),
});

export const removeMemberSchema = z.object({
  membershipId: z.string().min(1, "Membership ID is required."),
});

export const updateMemberRoleSchema = z.object({
  membershipId: z.string().min(1, "Membership ID is required."),
  role: z.enum(["admin", "member"], {
    message: "Role must be either admin or member.",
  }),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
