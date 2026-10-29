import type { Dictionary } from "@/i18n";
import type { SocialLinks } from "@/lib/social";
import { socialEntries } from "@/lib/social";
import { cn } from "@/lib/utils";

import { SocialIcon, SocialLinksRow } from "./social-icons";

/**
 * Phase 7C: "Follow Kabir Talks" — the site's filled-in social links, plus a
 * prominent WhatsApp Channel button when that link is set. Renders nothing
 * when no link is set, so there is never an empty box.
 */
export function FollowBox({
  links,
  labels,
  siteName,
  headingId = "follow-us",
  className,
}: {
  links: SocialLinks;
  labels: Dictionary["social"];
  siteName: string;
  headingId?: string;
  className?: string;
}) {
  if (socialEntries(links).length === 0) return null;
  return (
    <section aria-labelledby={headingId} data-follow-box className={cn("space-y-4 rounded-md border border-border bg-obsidian p-5 sm:p-6", className)}>
      <div className="space-y-1">
        <h2 id={headingId} className="text-lg text-ivory">
          {labels.follow}
        </h2>
        <p className="text-sm text-grey">{labels.followIntro}</p>
      </div>
      {links.whatsapp && <WhatsAppButton url={links.whatsapp} label={labels.followWhatsApp} newTab={labels.newTab} />}
      <SocialLinksRow links={links} owner={siteName} labels={labels} />
    </section>
  );
}

/** The WhatsApp Channel call to action: WhatsApp green with near-black text (9.9:1) in both themes. */
export function WhatsAppButton({ url, label, newTab, className }: { url: string; label: string; newTab: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-whatsapp-follow
      className={cn(
        "inline-flex min-h-11 items-center gap-2.5 rounded-md bg-[#25d366] px-5 py-2.5 text-base font-semibold text-[#0b1a10] transition-colors hover:bg-[#1fb857] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none",
        className,
      )}
    >
      <SocialIcon platform="whatsapp" className="size-5" />
      {label}
      <span className="sr-only"> {newTab}</span>
    </a>
  );
}

/** Homepage band: the WhatsApp Channel invitation, only when the link is set. */
export function WhatsAppBand({ url, labels }: { url: string | undefined; labels: Dictionary["social"] }) {
  if (!url) return null;
  return (
    <section aria-label={labels.whatsapp} data-whatsapp-band className="flex flex-col items-start gap-4 rounded-md border border-border bg-obsidian p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <p className="text-lg text-ivory">{labels.whatsAppIntro}</p>
      <WhatsAppButton url={url} label={labels.followWhatsApp} newTab={labels.newTab} className="shrink-0" />
    </section>
  );
}
