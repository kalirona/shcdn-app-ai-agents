import { z } from "zod";

export const addWebsiteSourceSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required."),
  url: z
    .string()
    .trim()
    .min(1, "URL is required.")
    .url("Please enter a valid URL.")
    .max(2048, "URL must be 2048 characters or less.")
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "URL must use HTTP or HTTPS protocol." },
    ),
  agentId: z.string().min(1, "Agent ID is required.").optional(),
});

export const addTextSourceSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required."),
  title: z.string().trim().min(1, "Title is required.").max(256, "Title must be 256 characters or less."),
  content: z
    .string()
    .trim()
    .min(10, "Content must be at least 10 characters.")
    .max(50000, "Content must be 50,000 characters or less."),
  agentId: z.string().min(1, "Agent ID is required.").optional(),
});

export const addFaqSourceSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required."),
  title: z.string().trim().min(1, "Title is required.").max(256, "Title must be 256 characters or less."),
  faqs: z
    .array(
      z.object({
        question: z.string().trim().min(1, "Question is required.").max(500),
        answer: z.string().trim().min(1, "Answer is required.").max(2000),
      }),
    )
    .min(1, "At least one FAQ is required.")
    .max(100, "Maximum 100 FAQs per source."),
  agentId: z.string().min(1, "Agent ID is required.").optional(),
});

export const deleteSourceSchema = z.object({
  sourceId: z.string().min(1, "Source ID is required."),
});

export const getAgentSourcesSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required."),
  agentId: z.string().min(1, "Agent ID is required."),
});

export type AddWebsiteSourceInput = z.infer<typeof addWebsiteSourceSchema>;
export type AddTextSourceInput = z.infer<typeof addTextSourceSchema>;
export type AddFaqSourceInput = z.infer<typeof addFaqSourceSchema>;
export type DeleteSourceInput = z.infer<typeof deleteSourceSchema>;
