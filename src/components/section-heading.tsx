import Link from "next/link";
import type { ReactNode } from "react";

/** Editorial section title: thin gold rule, heading, optional "view all" link. */
export function SectionHeading({
  id,
  title,
  href,
  linkLabel,
  aside,
}: {
  id?: string;
  title: string;
  href?: string;
  linkLabel?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="kt-rule mb-6 flex items-end justify-between gap-4 pt-4">
      <div className="flex items-center gap-3">
        <h2 id={id} className="text-2xl text-ivory sm:text-3xl">
          {title}
        </h2>
        {aside}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="shrink-0 text-sm text-gold transition-colors hover:text-gold-soft"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
