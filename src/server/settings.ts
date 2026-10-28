import "server-only";

import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { AD_PLACEMENTS, type AdPlacement, adSlots, siteSettings } from "@/db/schema";
import { AD_FORMATS, AD_LAYOUTS, LAYOUT_KEY_PATTERN, PUBLISHER_ID_PATTERN, SLOT_ID_PATTERN } from "@/lib/ads";
import { cacheTags } from "@/lib/cache-tags";

/**
 * Site settings stored as JSON in site_settings, one row per key, each
 * validated with Zod on the way out (a bad or missing row falls back to the
 * defaults, never crashes a page). Public reads are cached and expired by the
 * admin actions that change them (cacheTags.settings).
 */

const adsSchema = z.object({
  publisherId: z.string().regex(PUBLISHER_ID_PATTERN).nullable().catch(null),
  enabled: z.boolean().catch(false),
  autoAds: z.boolean().catch(false),
});
export type AdsSettings = z.infer<typeof adsSchema>;
const ADS_DEFAULTS: AdsSettings = { publisherId: null, enabled: false, autoAds: false };

const contactSchema = z.object({
  email: z.string().email().max(254).nullable().catch(null),
});
export type ContactSettings = z.infer<typeof contactSchema>;
const CONTACT_DEFAULTS: ContactSettings = { email: null };

const SCHEMAS = { ads: [adsSchema, ADS_DEFAULTS], contact: [contactSchema, CONTACT_DEFAULTS] } as const;
type Key = keyof typeof SCHEMAS;
type Value<K extends Key> = K extends "ads" ? AdsSettings : ContactSettings;

/** Uncached read (admin pages, actions). */
export async function readSetting<K extends Key>(key: K): Promise<Value<K>> {
  const [schema, defaults] = SCHEMAS[key];
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  if (!row) return defaults as Value<K>;
  const parsed = schema.safeParse(row.value);
  return (parsed.success ? parsed.data : defaults) as Value<K>;
}

export async function writeSetting<K extends Key>(key: K, value: Value<K>) {
  const [schema] = SCHEMAS[key];
  const data = schema.parse(value);
  await db
    .insert(siteSettings)
    .values({ key, value: data })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: data, updatedAt: new Date() } });
}

export type AdUnitConfig = { slotId: string; format: (typeof AD_FORMATS)[number]; layout: (typeof AD_LAYOUTS)[number] | null; layoutKey: string | null };
export type PublicAdsConfig = {
  publisherId: string;
  autoAds: boolean;
  placements: Partial<Record<AdPlacement, AdUnitConfig>>;
} | null;

const unitSchema = z.object({
  slotId: z.string().regex(SLOT_ID_PATTERN),
  format: z.enum(AD_FORMATS),
  layout: z.enum(AD_LAYOUTS).nullable(),
  layoutKey: z.string().regex(LAYOUT_KEY_PATTERN).nullable(),
});

/**
 * What the public pages need: null when ads are off or there is no
 * publisher ID; otherwise only the placements that are switched on and have
 * a valid slot. Cached; admin changes expire it.
 */
export async function getPublicAdsConfig(): Promise<PublicAdsConfig> {
  "use cache";
  cacheLife("days");
  cacheTag(cacheTags.settings);

  const ads = await readSetting("ads");
  if (!ads.enabled || !ads.publisherId) return null;
  const rows = await db.select().from(adSlots);
  const placements: Partial<Record<AdPlacement, AdUnitConfig>> = {};
  for (const row of rows) {
    if (!row.isEnabled || !AD_PLACEMENTS.includes(row.placement)) continue;
    const unit = unitSchema.safeParse({ slotId: row.slotId, format: row.adFormat, layout: row.adLayout, layoutKey: row.adLayoutKey });
    if (unit.success) placements[row.placement] = unit.data;
  }
  return { publisherId: ads.publisherId, autoAds: ads.autoAds, placements };
}

/** The publisher ID for /ads.txt, whether or not ads are switched on. Cached. */
export async function getPublisherId(): Promise<string | null> {
  "use cache";
  cacheLife("days");
  cacheTag(cacheTags.settings);
  return (await readSetting("ads")).publisherId;
}

/** Public contact email (Contact page). Cached. */
export async function getContactEmail(): Promise<string | null> {
  "use cache";
  cacheLife("days");
  cacheTag(cacheTags.settings);
  return (await readSetting("contact")).email;
}

export { ADS_DEFAULTS, CONTACT_DEFAULTS };
