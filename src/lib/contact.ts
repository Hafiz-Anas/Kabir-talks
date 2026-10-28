import { z } from "zod";

/** Contact form rules, shared by the form (browser) and /api/contact (server). */
export const CONTACT_LIMITS = { name: 80, subject: 150, message: 5_000 } as const;

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(CONTACT_LIMITS.name),
  email: z.string().trim().toLowerCase().max(254).email(),
  subject: z.string().trim().min(1).max(CONTACT_LIMITS.subject),
  message: z.string().trim().min(10).max(CONTACT_LIMITS.message),
  locale: z.enum(["en", "ur"]),
  /** Honeypot. */
  website: z.string().max(500).optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;
export const CONTACT_FIELDS = ["name", "email", "subject", "message"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];
