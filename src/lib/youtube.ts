/**
 * Phase 7C "Latest videos": the channel's public RSS feed (no API key).
 * Pure helpers, so the parser can be tested with a saved sample feed.
 */

/** YouTube channel IDs: "UC" + 22 characters. */
export const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
export const YOUTUBE_FEED_BASE = "https://www.youtube.com/feeds/videos.xml";
export const MAX_VIDEOS = 6;

export type YouTubeVideo = { id: string; title: string; publishedAt: string | null };

export function feedUrl(channelId: string, base = YOUTUBE_FEED_BASE) {
  return `${base}?channel_id=${encodeURIComponent(channelId)}`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Decodes the XML entities a feed title can contain. */
export function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] === "#") {
        const point = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    });
}

function tag(xml: string, name: string) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return match ? decodeXml(match[1]).trim() : null;
}

/**
 * Reads up to `limit` videos from an Atom feed. Anything that doesn't look
 * like a valid entry (bad video ID, no title) is skipped; garbage in gives an
 * empty list, never an exception. Thumbnails are not taken from the feed: the
 * page builds them from the video ID (i.ytimg.com), so no other URL is trusted.
 */
export function parseYouTubeFeed(xml: unknown, limit = MAX_VIDEOS): YouTubeVideo[] {
  if (typeof xml !== "string" || !xml.includes("<feed")) return [];
  const videos: YouTubeVideo[] = [];
  for (const entry of xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) ?? []) {
    const id = tag(entry, "yt:videoId");
    const title = tag(entry, "title")?.replace(/\s+/g, " ");
    if (!id || !VIDEO_ID_PATTERN.test(id) || !title) continue;
    const published = tag(entry, "published");
    const date = published ? new Date(published) : null;
    videos.push({ id, title: title.slice(0, 200), publishedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null });
    if (videos.length >= limit) break;
  }
  return videos;
}

export function videoThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Privacy-enhanced embed, loaded only after the reader clicks play. */
export function videoEmbedUrl(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
}

export function videoWatchUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}
