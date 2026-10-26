/**
 * URL allow-lists shared by the editor (client), the sanitizer and the
 * renderer (server). Every check parses with `URL` — never regex-only — so
 * tricks like "javascript&colon;", control characters or `//host` fail.
 */

const CONTROL_CHARS = /[\u0000-\u001F\u007F\s]/;

function parse(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048 || CONTROL_CHARS.test(trimmed)) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/** Links: only http(s) and mailto. */
export function safeLinkHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = parse(value);
  if (!url) return null;
  if (url.protocol === "http:" || url.protocol === "https:") {
    return url.hostname ? url.toString() : null;
  }
  if (url.protocol === "mailto:") {
    return /^[^@\s]+@[^@\s]+$/.test(decodeURIComponent(url.pathname)) ? url.toString() : null;
  }
  return null;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
]);

/** Returns the 11-character video id for youtube.com / youtu.be URLs, else null. */
export function parseYouTubeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = parse(value);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) return null;
  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;

  let id: string | null = null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.hostname.toLowerCase() === "youtu.be") {
    id = parts[0] ?? null;
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else if (["embed", "shorts", "live", "v"].includes(parts[0] ?? "")) {
    id = parts[1] ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** Optional start time (seconds) from ?t= / ?start=. */
export function parseYouTubeStart(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const url = parse(value);
  const raw = url?.searchParams.get("start") ?? url?.searchParams.get("t");
  if (!raw) return undefined;
  const seconds = Number.parseInt(raw.replace(/s$/, ""), 10);
  return Number.isFinite(seconds) && seconds > 0 && seconds < 86_400 ? seconds : undefined;
}

export function youTubeWatchUrl(id: string, start?: number) {
  return `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}` : ""}`;
}

const X_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "mobile.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
]);

/** Normalises x.com / twitter.com status URLs to https://x.com/{user}/status/{id}, else null. */
export function normalizeXStatusUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = parse(value);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) return null;
  if (!X_HOSTS.has(url.hostname.toLowerCase())) return null;
  const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,25})\/?$/);
  return match ? `https://x.com/${match[1]}/status/${match[2]}` : null;
}

export const ARTICLE_IMAGE_BUCKET = "article-images";

/** Public URL prefix for uploaded article images, e.g. https://abc.supabase.co/storage/v1/object/public/article-images/ */
export function storagePublicPrefix(supabaseUrl: string | undefined | null): string | null {
  if (!supabaseUrl) return null;
  try {
    const base = new URL(supabaseUrl);
    return `${base.origin}/storage/v1/object/public/${ARTICLE_IMAGE_BUCKET}/`;
  } catch {
    return null;
  }
}

/** Object paths we generate: articles/{yyyy}/{mm}/{uuid}.{ext} */
export const IMAGE_OBJECT_PATH = /^articles\/\d{4}\/(0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif)$/;

/**
 * Images may only come from our own Storage bucket, at a path our upload
 * pipeline generated. Anything else (external hosts, data: URIs) is rejected.
 */
export function safeImageSrc(value: unknown, publicPrefix: string | null): string | null {
  if (typeof value !== "string" || !publicPrefix) return null;
  if (!value.startsWith(publicPrefix)) return null;
  const objectPath = value.slice(publicPrefix.length);
  return IMAGE_OBJECT_PATH.test(objectPath) ? value : null;
}

/** Reader profile photos: avatars/{userId}/{uuid}.{ext} in the same bucket (src/server/account-actions.ts). */
export const AVATAR_OBJECT_PATH =
  /^avatars\/[A-Za-z0-9_-]{1,64}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif)$/;

const GOOGLE_AVATAR_HOST = "lh3.googleusercontent.com";

/**
 * Profile photos may come from our bucket (uploaded through the avatar
 * pipeline) or from Google (the account's Google photo). Anything else → null,
 * and the initials avatar is shown instead.
 */
export function safeAvatarSrc(value: unknown, publicPrefix: string | null): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  if (publicPrefix && value.startsWith(publicPrefix)) {
    return AVATAR_OBJECT_PATH.test(value.slice(publicPrefix.length)) ? value : null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === GOOGLE_AVATAR_HOST ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Phase 6 "Listen": generated audio lives in its own public bucket (WAV, larger than images). */
export const ARTICLE_AUDIO_BUCKET = "article-audio";

/** Public URL of a generated audio file, e.g. https://abc.supabase.co/storage/v1/object/public/article-audio/audio/{id}/en-ab12.wav */
export function audioPublicUrl(supabaseUrl: string | undefined | null, path: string): string | null {
  if (!supabaseUrl) return null;
  try {
    return `${new URL(supabaseUrl).origin}/storage/v1/object/public/${ARTICLE_AUDIO_BUCKET}/${path}`;
  } catch {
    return null;
  }
}
