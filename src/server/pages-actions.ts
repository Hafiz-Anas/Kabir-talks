"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { SITE_PAGE_SLUGS, sitePages } from "@/db/schema";
import { locales } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth-guards";
import { cacheTags } from "@/lib/cache-tags";
import { isDocEmpty, sanitizeDoc } from "@/lib/content/document";

import { imagePrefix } from "./storage";

/** Privacy Policy / Terms of Use edits. requireAdmin() + Zod; bodies go through the same sanitizer as articles. */

const pageSchema = z.object({
  slug: z.enum(SITE_PAGE_SLUGS),
  titleEn: z.string().trim().min(1, "English title is required").max(120),
  titleUr: z.string().trim().min(1, "Urdu title is required").max(120),
  bodyEn: z.unknown(),
  bodyUr: z.unknown(),
});

export type SavePageResult = { ok: true; removed: string[] } | { ok: false; error: string };

export async function saveSitePage(input: z.input<typeof pageSchema>): Promise<SavePageResult> {
  const session = await requireAdmin();
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid page." };
  const data = parsed.data;

  const prefix = imagePrefix();
  const en = sanitizeDoc(data.bodyEn, { imagePrefix: prefix });
  const ur = sanitizeDoc(data.bodyUr, { imagePrefix: prefix });
  if (isDocEmpty(en.doc) || isDocEmpty(ur.doc)) return { ok: false, error: "Both the English and the Urdu text are needed." };

  await db
    .update(sitePages)
    .set({ titleEn: data.titleEn, titleUr: data.titleUr, bodyEn: en.doc, bodyUr: ur.doc, isTemplate: false, updatedBy: session.user.id })
    .where(eq(sitePages.slug, data.slug));

  updateTag(cacheTags.pages);
  for (const locale of locales) revalidatePath(`/${locale}/${data.slug}`);
  revalidatePath("/admin/pages");
  return { ok: true, removed: [...new Set([...en.removed, ...ur.removed])] };
}
