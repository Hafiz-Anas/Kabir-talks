"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { AD_PLACEMENTS, adSlots } from "@/db/schema";
import { extractPublisherId, parseAdUnit } from "@/lib/ads";
import { requireAdmin } from "@/lib/auth-guards";
import { cacheTags } from "@/lib/cache-tags";

import { readSetting, writeSetting } from "./settings";

/**
 * Ads admin actions. Pasted AdSense code is only parsed for IDs here (the
 * same rules as the form's live check, src/lib/ads.ts); the code itself is
 * never stored. Saving re-renders the public pages so they pick up the change.
 */

export type AdsActionResult = { ok: true; message: string } | { ok: false; error: string };

function refreshPublicPages() {
  updateTag(cacheTags.settings);
  revalidatePath("/[locale]", "layout");
  revalidatePath("/ads.txt");
  revalidatePath("/admin/ads");
}

const settingsSchema = z.object({
  publisher: z.string().max(5_000),
  enabled: z.boolean(),
  autoAds: z.boolean(),
});

export async function saveAdsSettings(input: z.input<typeof settingsSchema>): Promise<AdsActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid settings." };
  const { publisher, enabled, autoAds } = parsed.data;

  let publisherId: string | null = null;
  if (publisher.trim()) {
    const id = extractPublisherId(publisher);
    if (!id.ok) return { ok: false, error: id.error };
    publisherId = id.value;
  }
  if ((enabled || autoAds) && !publisherId) return { ok: false, error: "Add your publisher ID before switching ads on." };

  await writeSetting("ads", { publisherId, enabled, autoAds });
  refreshPublicPages();
  return { ok: true, message: publisherId ? `Saved. Publisher ID: ${publisherId}.` : "Saved. No publisher ID, so ads and ads.txt are off." };
}

const placementSchema = z.object({
  placement: z.enum(AD_PLACEMENTS),
  enabled: z.boolean(),
  unit: z.string().max(5_000),
});

export async function saveAdPlacement(input: z.input<typeof placementSchema>): Promise<AdsActionResult> {
  await requireAdmin();
  const parsed = placementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid placement." };
  const { placement, enabled, unit } = parsed.data;

  let values: { slotId: string | null; adFormat: string; adLayout: string | null; adLayoutKey: string | null } = {
    slotId: null,
    adFormat: "auto",
    adLayout: null,
    adLayoutKey: null,
  };
  if (unit.trim()) {
    const { publisherId } = await readSetting("ads");
    const result = parseAdUnit(unit, publisherId);
    if (!result.ok) return { ok: false, error: result.error };
    values = { slotId: result.value.slotId, adFormat: result.value.format, adLayout: result.value.layout, adLayoutKey: result.value.layoutKey };
  }
  if (enabled && !values.slotId) return { ok: false, error: "Add the ad unit (or its slot ID) before switching this placement on." };

  await db
    .insert(adSlots)
    .values({ placement, isEnabled: enabled, ...values })
    .onConflictDoUpdate({ target: adSlots.placement, set: { isEnabled: enabled, ...values } });
  refreshPublicPages();
  return { ok: true, message: values.slotId ? `Saved: slot ${values.slotId}${enabled ? "" : " (switched off)"}.` : "Saved: no ad unit." };
}

/** Admin page data (uncached). */
export async function loadAdsAdmin() {
  await requireAdmin();
  const [settings, rows] = await Promise.all([readSetting("ads"), db.select().from(adSlots)]);
  return {
    settings,
    placements: AD_PLACEMENTS.map((placement) => {
      const row = rows.find((r) => r.placement === placement);
      return {
        placement,
        enabled: row?.isEnabled ?? false,
        slotId: row?.slotId ?? null,
        format: row?.adFormat ?? "auto",
        layout: row?.adLayout ?? null,
        layoutKey: row?.adLayoutKey ?? null,
      };
    }),
  };
}
