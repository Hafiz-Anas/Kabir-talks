"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { Dictionary } from "@/i18n";
import { videoEmbedUrl, videoThumbnail, type YouTubeVideo } from "@/lib/youtube";

/**
 * One video: a thumbnail button until clicked, then the privacy-enhanced
 * (youtube-nocookie.com) player. No iframe and no YouTube script before the
 * click. The thumbnail goes through next/image, so readers' browsers don't
 * contact YouTube just by opening the homepage.
 */
export function VideoPlayer({ video, labels }: { video: YouTubeVideo; labels: Dictionary["videos"] }) {
  const [playing, setPlaying] = useState(false);

  return (
    <figure className="space-y-3" data-video={video.id}>
      <div className="relative aspect-video overflow-hidden rounded-sm bg-obsidian-raised">
        {playing ? (
          <iframe
            src={videoEmbedUrl(video.id)}
            title={video.title}
            className="absolute inset-0 size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 focus-visible:outline-none"
            aria-label={`${labels.play}: ${video.title}`}
          >
            <Image src={videoThumbnail(video.id)} alt="" fill sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            <span className="absolute inset-0 grid place-items-center bg-[rgb(0_0_0/0.25)] transition-colors group-hover:bg-[rgb(0_0_0/0.1)] group-focus-visible:ring-4 group-focus-visible:ring-ring group-focus-visible:ring-inset">
              <span className="grid size-14 place-items-center rounded-full bg-[#c4302b] text-white shadow-lg">
                <Play aria-hidden className="size-6 translate-x-0.5 fill-current" />
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="line-clamp-2 text-base text-ivory" dir="auto">
        {video.title}
      </figcaption>
    </figure>
  );
}
