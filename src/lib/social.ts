import { z } from "zod";

/**
 * Social profile links (Phase 7C): the site's own (Settings → Social links)
 * and each author's. Pure, so the admin forms, server actions and tests share
 * one set of rules: https only, no credentials or ports, the platform's own
 * domain (or a subdomain of it), and a real path (not just the homepage).
 */

export const SOCIAL_PLATFORMS = ["youtube", "whatsapp", "facebook", "instagram", "x", "tiktok"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialLinks = Partial<Record<SocialPlatform, string>>;

export const SOCIAL_PLATFORM_NAMES: Record<SocialPlatform, string> = {
  youtube: "YouTube",
  whatsapp: "WhatsApp Channel",
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
};

/** Allowed hosts per platform; subdomains (www., m.) of these count too. */
export const SOCIAL_HOSTS: Record<SocialPlatform, string[]> = {
  youtube: ["youtube.com", "youtu.be"],
  whatsapp: ["whatsapp.com"],
  facebook: ["facebook.com", "fb.com"],
  instagram: ["instagram.com"],
  x: ["x.com", "twitter.com"],
  tiktok: ["tiktok.com"],
};

export const SOCIAL_EXAMPLES: Record<SocialPlatform, string> = {
  youtube: "https://www.youtube.com/@kabirtalks",
  whatsapp: "https://whatsapp.com/channel/…",
  facebook: "https://www.facebook.com/kabirtalks",
  instagram: "https://www.instagram.com/kabirtalks",
  x: "https://x.com/kabirtalks",
  tiktok: "https://www.tiktok.com/@kabirtalks",
};

export type SocialUrlResult = { ok: true; url: string } | { ok: false; error: string };

/** Validates one profile link for a platform and returns it normalized. */
export function validateSocialUrl(platform: SocialPlatform, value: string): SocialUrlResult {
  const name = SOCIAL_PLATFORM_NAMES[platform];
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { ok: false, error: `Enter the full ${name} link, starting with https://` };
  }
  if (url.protocol !== "https:") return { ok: false, error: "The link must start with https://" };
  if (url.username || url.password || url.port) return { ok: false, error: "That doesn’t look like a normal profile link." };
  const host = url.hostname.toLowerCase();
  if (!SOCIAL_HOSTS[platform].some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    return { ok: false, error: `This must be a ${SOCIAL_HOSTS[platform].join(" or ")} link.` };
  }
  if (url.pathname.replace(/\/+$/, "") === "") return { ok: false, error: `Link to the profile itself, not the ${name} homepage.` };
  if (platform === "whatsapp" && !/^\/channel\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) {
    return { ok: false, error: "Use the WhatsApp Channel link (https://whatsapp.com/channel/…)." };
  }
  return { ok: true, url: url.toString() };
}

/**
 * Form input → stored links: empty fields are dropped, every filled one must
 * pass validateSocialUrl (errors are reported per platform).
 */
export const socialLinksInputSchema = z
  .object(Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, z.string().max(500).optional()])) as Record<SocialPlatform, z.ZodOptional<z.ZodString>>)
  .transform((input, ctx) => {
    const out: SocialLinks = {};
    for (const platform of SOCIAL_PLATFORMS) {
      const value = input[platform]?.trim();
      if (!value) continue;
      const result = validateSocialUrl(platform, value);
      if (result.ok) out[platform] = result.url;
      else ctx.addIssue({ code: "custom", path: [platform], message: result.error });
    }
    return out;
  });

/** Stored links read back (lenient: anything invalid is simply left out). */
export function cleanSocialLinks(value: unknown): SocialLinks {
  const out: SocialLinks = {};
  if (!value || typeof value !== "object") return out;
  for (const platform of SOCIAL_PLATFORMS) {
    const raw = (value as Record<string, unknown>)[platform];
    if (typeof raw !== "string") continue;
    const result = validateSocialUrl(platform, raw);
    if (result.ok) out[platform] = result.url;
  }
  return out;
}

/** The filled-in links in display order. */
export function socialEntries(links: SocialLinks): { platform: SocialPlatform; url: string }[] {
  return SOCIAL_PLATFORMS.flatMap((platform) => (links[platform] ? [{ platform, url: links[platform]! }] : []));
}
