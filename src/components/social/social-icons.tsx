import type { SVGProps } from "react";

import { fill } from "@/i18n";
import { type SocialLinks, type SocialPlatform, socialEntries } from "@/lib/social";
import { cn } from "@/lib/utils";

/**
 * Phase 7C: platform icons and the row of profile links used in the footer,
 * mobile menu, About page, author pages and the end of articles. Simple
 * outline glyphs drawn in currentColor (lucide no longer ships brand icons).
 * No hooks, so Server and Client Components can both render it.
 */

const PATHS: Record<SocialPlatform, React.ReactNode> = {
  youtube: (
    <>
      <path d="M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M9 9.5c.4 2.6 2.4 4.6 5 5l1-1.5-1.8-1-1 .8a3.6 3.6 0 0 1-1.5-1.5l.8-1-1-1.8z" />
    </>
  ),
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  instagram: (
    <>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </>
  ),
  x: (
    <>
      <path d="M4 4l11.7 16H20L8.3 4z" />
      <path d="M4 20l6.8-6.8M20 4l-6.8 6.8" />
    </>
  ),
  tiktok: <path d="M9 12a4 4 0 1 0 4 4V3c.5 2.5 2.5 4.5 5 5" />,
};

export function SocialIcon({ platform, ...props }: { platform: SocialPlatform } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...props}
    >
      {PATHS[platform]}
    </svg>
  );
}

export type SocialLabels = Record<SocialPlatform, string> & { onPlatform: string; newTab: string };

/**
 * A row of icon links, one per filled-in platform. Renders nothing at all
 * when no link is set. `owner` names whose profile it is ("Kabir Talks on
 * YouTube"); each link opens in a new tab.
 */
export function SocialLinksRow({
  links,
  owner,
  labels,
  size = "md",
  className,
}: {
  links: SocialLinks;
  owner: string;
  labels: SocialLabels;
  size?: "sm" | "md";
  className?: string;
}) {
  const entries = socialEntries(links);
  if (entries.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-2", className)} data-social-links>
      {entries.map(({ platform, url }) => (
        <li key={platform}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-platform={platform}
            aria-label={`${fill(labels.onPlatform, { name: owner, platform: labels[platform] })} ${labels.newTab}`}
            className={cn(
              "grid place-items-center rounded-full border border-border text-grey transition-colors hover:border-gold hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              size === "sm" ? "size-9" : "size-10",
            )}
          >
            <SocialIcon platform={platform} className={size === "sm" ? "size-4" : "size-[1.125rem]"} />
          </a>
        </li>
      ))}
    </ul>
  );
}
