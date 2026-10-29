"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { locales } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth-guards";
import { cacheTags } from "@/lib/cache-tags";
import { SOCIAL_PLATFORMS, socialLinksInputSchema } from "@/lib/social";

import { writeSetting } from "./settings";

/** Admin → Settings. requireAdmin() + Zod. */

const contactSchema = z.object({
  email: z.union([z.literal(""), z.string().trim().toLowerCase().max(254).email()]),
});

export type SettingsResult = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function saveContactSettings(input: z.input<typeof contactSchema>): Promise<SettingsResult> {
  await requireAdmin();
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please enter a valid email address, or leave it empty." };
  const email = parsed.data.email.trim() || null;
  await writeSetting("contact", { email });
  updateTag(cacheTags.settings);
  for (const locale of locales) revalidatePath(`/${locale}/contact`);
  return { ok: true, message: email ? `Saved. The Contact page shows ${email}.` : "Saved. No public email is shown." };
}

const opinionSchema = z.object({
  disclaimerEn: z.string().trim().max(300, "At most 300 characters"),
  disclaimerUr: z.string().trim().max(300, "At most 300 characters"),
});

/** Phase 7C: the disclaimer under opinion pieces. Empty fields fall back to the default wording. */
export async function saveOpinionSettings(input: z.input<typeof opinionSchema>): Promise<SettingsResult> {
  await requireAdmin();
  const parsed = opinionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  await writeSetting("opinion", parsed.data);
  updateTag(cacheTags.settings);
  revalidatePath("/[locale]", "layout");
  return { ok: true, message: "Saved. Opinion pages show the new wording." };
}

/**
 * Phase 7C: the site's social links. Each filled field must be an https link
 * on that platform's domain (src/lib/social.ts); empty fields are removed.
 * Every public page shows them (footer), so the whole site is refreshed.
 */
export async function saveSocialSettings(input: unknown): Promise<SettingsResult> {
  await requireAdmin();
  const parsed = socialLinksInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { ok: false, error: "Please fix the highlighted links.", fieldErrors };
  }
  await writeSetting("social", parsed.data);
  updateTag(cacheTags.settings);
  revalidatePath("/[locale]", "layout");
  const count = SOCIAL_PLATFORMS.filter((platform) => parsed.data[platform]).length;
  return { ok: true, message: count ? `Saved. ${count} link${count === 1 ? "" : "s"} shown on the site.` : "Saved. No social links are shown." };
}
