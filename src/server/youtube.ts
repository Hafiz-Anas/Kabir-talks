import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { cacheTags } from "@/lib/cache-tags";
import { env } from "@/lib/env";
import { feedUrl, parseYouTubeFeed, YOUTUBE_FEED_BASE, type YouTubeVideo } from "@/lib/youtube";

import { readSetting } from "./settings";

/**
 * Phase 7C "Latest videos": reads the channel's public RSS feed on the server
 * (no API key). Cached for about an hour; the homepage revalidates with it.
 * Any failure (network, timeout, HTTP error, not a feed) returns no videos,
 * so the section is simply hidden, and is retried after five minutes.
 * YOUTUBE_FEED_URL replaces the feed host in tests (a saved sample feed).
 */
export async function getLatestVideos(): Promise<{ videos: YouTubeVideo[]; channelId: string | null }> {
  "use cache";
  cacheTag(cacheTags.settings, cacheTags.youtube);

  const { enabled, channelId } = await readSetting("youtube");
  if (!enabled || !channelId) {
    cacheLife("days");
    return { videos: [], channelId: null };
  }
  try {
    const response = await fetch(feedUrl(channelId, env.YOUTUBE_FEED_URL ?? YOUTUBE_FEED_BASE), {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/atom+xml, application/xml;q=0.9, */*;q=0.1" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const videos = parseYouTubeFeed(await response.text());
    if (videos.length === 0) throw new Error("no videos in feed");
    cacheLife({ stale: 300, revalidate: 3600, expire: 86_400 });
    return { videos, channelId };
  } catch (error) {
    console.warn("YouTube feed unavailable:", error instanceof Error ? error.message : error);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
    return { videos: [], channelId };
  }
}
