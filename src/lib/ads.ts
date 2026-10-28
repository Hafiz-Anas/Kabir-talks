/**
 * AdSense ID extraction (Phase 7). The admin may paste a whole AdSense
 * snippet; only the IDs are kept, after validation. Nothing pasted is ever
 * stored or rendered as HTML: the site builds the script URL and the <ins>
 * tag itself from these IDs (src/components/ads/*).
 *
 * Pure module, shared by the admin form (browser preview) and the server
 * actions (the real check).
 */

/** Publisher ID as used in data-ad-client: "ca-pub-" + 16 digits. */
export const PUBLISHER_ID_PATTERN = /^ca-pub-\d{16}$/;
export const SLOT_ID_PATTERN = /^\d{8,12}$/;
export const AD_FORMATS = ["auto", "fluid", "rectangle", "horizontal", "vertical"] as const;
export type AdFormat = (typeof AD_FORMATS)[number];
export const AD_LAYOUTS = ["in-article"] as const;
export const LAYOUT_KEY_PATTERN = /^[-+a-z0-9]{2,40}$/i;

const MAX_INPUT = 5_000;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Accepts "ca-pub-1234567890123456", "pub-1234567890123456", the AdSense
 * <script> tag, a meta tag, or an ads.txt line. Rejects anything with no ID,
 * or with two different IDs.
 */
export function extractPublisherId(input: string): ParseResult<string> {
  const text = input.trim();
  if (!text) return { ok: false, error: "Paste your publisher ID or the AdSense code." };
  if (text.length > MAX_INPUT) return { ok: false, error: "That’s too long to be AdSense code." };
  // \b keeps "pub-" from matching inside a longer word; exactly 16 digits, not followed by another digit.
  const found = new Set([...text.matchAll(/\b(?:ca-)?pub-(\d+)\b/g)].map((m) => m[1]));
  if (found.size === 0) return { ok: false, error: "No publisher ID found. It looks like ca-pub- followed by 16 digits." };
  if (found.size > 1) return { ok: false, error: "That code contains more than one publisher ID." };
  const [digits] = found;
  if (!/^\d{16}$/.test(digits)) return { ok: false, error: "A publisher ID has exactly 16 digits after ca-pub-." };
  return { ok: true, value: `ca-pub-${digits}` };
}

export type AdUnit = { slotId: string; format: AdFormat; layout: (typeof AD_LAYOUTS)[number] | null; layoutKey: string | null };

function attribute(text: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = text.match(re);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "").trim() : null;
}

/**
 * Accepts a bare slot ID ("1234567890") or a full AdSense ad unit. Reads
 * data-ad-slot, data-ad-format, data-ad-layout and data-ad-layout-key; if the
 * code names a publisher (data-ad-client), it must match `publisherId`.
 */
export function parseAdUnit(input: string, publisherId: string | null): ParseResult<AdUnit> {
  const text = input.trim();
  if (!text) return { ok: false, error: "Paste the ad unit code or its slot ID." };
  if (text.length > MAX_INPUT) return { ok: false, error: "That’s too long to be an ad unit." };

  if (/^\d+$/.test(text)) {
    return SLOT_ID_PATTERN.test(text)
      ? { ok: true, value: { slotId: text, format: "auto", layout: null, layoutKey: null } }
      : { ok: false, error: "A slot ID is 8 to 12 digits." };
  }

  const slots = new Set([...text.matchAll(/data-ad-slot\s*=\s*["']?([^"'\s>]*)/gi)].map((m) => m[1]));
  if (slots.size === 0) return { ok: false, error: "No data-ad-slot found. Paste the ad unit code from AdSense → Ads → By ad unit." };
  if (slots.size > 1) return { ok: false, error: "That code contains more than one ad unit. Paste one at a time." };
  const [slotId] = slots;
  if (!SLOT_ID_PATTERN.test(slotId)) return { ok: false, error: "The slot ID in that code isn’t valid (8 to 12 digits)." };

  const client = attribute(text, "data-ad-client");
  if (client !== null) {
    if (!PUBLISHER_ID_PATTERN.test(client)) return { ok: false, error: "The publisher ID in that code isn’t valid." };
    if (!publisherId) return { ok: false, error: "Save the publisher ID first, so the ad unit can be checked against it." };
    if (client !== publisherId) return { ok: false, error: `That ad unit belongs to ${client}, not ${publisherId}.` };
  }

  const format = (attribute(text, "data-ad-format") ?? "auto").toLowerCase();
  if (!(AD_FORMATS as readonly string[]).includes(format)) return { ok: false, error: `Unsupported ad format "${format.slice(0, 30)}".` };

  const layout = attribute(text, "data-ad-layout")?.toLowerCase() ?? null;
  if (layout !== null && !(AD_LAYOUTS as readonly string[]).includes(layout)) return { ok: false, error: `Unsupported ad layout "${layout.slice(0, 30)}".` };

  const layoutKey = attribute(text, "data-ad-layout-key");
  if (layoutKey !== null && !LAYOUT_KEY_PATTERN.test(layoutKey)) return { ok: false, error: "The layout key in that code isn’t valid." };

  return { ok: true, value: { slotId, format: format as AdFormat, layout: layout as AdUnit["layout"], layoutKey } };
}

/** The ads.txt line for a publisher ID (Google's certification authority ID is fixed). */
export function adsTxtLine(publisherId: string) {
  return `google.com, ${publisherId.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0`;
}

/** Space reserved for each placement before the ad loads (avoids layout jumps). */
export const AD_PLACEMENT_INFO = {
  "home-top": { label: "Homepage top", minHeight: "min-h-[100px] sm:min-h-[90px]" },
  "home-feed": { label: "Homepage feed", minHeight: "min-h-[250px]" },
  "article-top": { label: "Article top", minHeight: "min-h-[100px] sm:min-h-[90px]" },
  "article-inline": { label: "Inside the article", minHeight: "min-h-[250px]" },
  "article-bottom": { label: "Article bottom", minHeight: "min-h-[250px]" },
} as const;
