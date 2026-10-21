import type { LucideIcon } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

/** Understated homepage teaser for a feature from a later phase (newsletter, trending). */
export function ComingSoonStrip({
  icon: Icon,
  title,
  description,
  label,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  label: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-md border border-gold-muted/40 bg-obsidian p-6">
      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold-muted/60 text-gold">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl text-ivory">{title}</h2>
          <ComingSoon label={label} />
        </div>
        <p className="text-sm text-grey">{description}</p>
      </div>
    </div>
  );
}
