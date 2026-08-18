import { z } from "zod";

export const savePlatformSettingsSchema = z.object({
  platformName: z.string().trim().max(128).optional().nullable(),
  supportEmail: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .max(256)
    .optional()
    .nullable()
    .or(z.literal("")),
  maintenanceMode: z.boolean().optional(),
  signupEnabled: z.boolean().optional(),
  defaultWorkspacePlan: z.string().trim().max(32).optional().nullable(),
});

export const saveSecuritySettingsSchema = z.object({
  sessionTimeoutHours: z.number().int().min(1).max(8760).default(24),
  require2fa: z.boolean().default(false),
});

export const saveEmailSettingsSchema = z.object({
  smtpHost: z.string().trim().max(256).optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpUser: z.string().trim().max(256).optional().nullable(),
  smtpPassword: z.string().trim().max(512).optional().nullable(),
  fromEmail: z.string().trim().email("Please enter a valid email address.").max(256).optional().nullable(),
});

export const saveStorageSettingsSchema = z.object({
  r2AccountId: z.string().trim().max(256).optional().nullable(),
  r2AccessKeyId: z.string().trim().max(256).optional().nullable(),
  r2AccessKeySecret: z.string().trim().max(512).optional().nullable(),
  r2Bucket: z.string().trim().max(256).optional().nullable(),
  r2PublicUrl: z.string().trim().url("Please enter a valid URL.").max(512).optional().nullable().or(z.literal("")),
});

export type SavePlatformSettingsInput = z.infer<typeof savePlatformSettingsSchema>;
export type SaveSecuritySettingsInput = z.infer<typeof saveSecuritySettingsSchema>;
export type SaveEmailSettingsInput = z.infer<typeof saveEmailSettingsSchema>;
export type SaveStorageSettingsInput = z.infer<typeof saveStorageSettingsSchema>;
