import { SocialIcon } from "@/components/social/social-icons";
import { SectionHeading } from "@/components/section-heading";
import type { Dictionary } from "@/i18n";
import type { YouTubeVideo } from "@/lib/youtube";

import { VideoPlayer } from "./video-player";

/**
 * Phase 7C homepage "Latest videos": the channel's newest uploads from its
 * public feed (src/server/youtube.ts). Thumbnails only until the reader
 * clicks: the player iframe is created then, so the page stays light and
 * YouTube sees nothing from readers who don't play a video.
 * Renders nothing when switched off, unconfigured, or the feed failed.
 */
export function LatestVideos({
  videos,
  labels,
  channelUrl,
  newTab,
}: {
  videos: YouTubeVideo[];
  labels: Dictionary["videos"];
  channelUrl: string;
  newTab: string;
}) {
  if (videos.length === 0) return null;
  return (
    <section aria-labelledby="latest-videos" data-latest-videos>
      <SectionHeading id="latest-videos" title={labels.title} />
      <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <li key={video.id}>
            <VideoPlayer video={video} labels={labels} />
          </li>
        ))}
      </ul>
      <p className="mt-6">
        <a
          href={channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-gold underline-offset-4 hover:text-gold-soft hover:underline"
        >
          <SocialIcon platform="youtube" className="size-4" />
          {labels.channel}
          <span className="sr-only"> {newTab}</span>
        </a>
      </p>
    </section>
  );
}
