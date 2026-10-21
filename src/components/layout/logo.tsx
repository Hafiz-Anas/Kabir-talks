import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Placeholder brand mark: gold "KT" monogram + "Kabir Talks" wordmark.
 * Swap the contents of this component for the real logo later; every page
 * uses it through this single component.
 */
export function Logo({
  href,
  className,
  showWordmark = true,
  label = "Kabir Talks — home",
}: {
  href: string;
  className?: string;
  showWordmark?: boolean;
  /** Accessible name; public pages pass the localized one. */
  label?: string;
}) {
  return (
    <Link
      href={href}
      lang="en"
      dir="ltr"
      aria-label={label}
      className={cn(
        "group inline-flex shrink-0 items-center gap-2.5 rounded-sm sm:gap-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid size-8 place-items-center border border-gold font-serif text-xs font-semibold tracking-[0.08em] text-gold transition-colors group-hover:border-gold-soft group-hover:text-gold-soft sm:size-10 sm:text-base"
      >
        KT
      </span>
      {showWordmark && (
        <span className="font-serif text-lg font-semibold tracking-tight whitespace-nowrap text-ivory sm:text-2xl">
          Kabir Talks
        </span>
      )}
    </Link>
  );
}
