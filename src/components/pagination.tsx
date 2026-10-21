import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { type Dictionary, fill } from "@/i18n";

/**
 * Previous / next links for ?page= listings. Page 1 links to the bare path
 * (its canonical URL). Chevrons flip in RTL via rtl:rotate-180.
 */
export function Pagination({
  basePath,
  page,
  pages,
  labels,
  query,
}: {
  basePath: string;
  page: number;
  pages: number;
  labels: Dictionary["listing"];
  /** Extra query params to keep (e.g. the search term). */
  query?: Record<string, string>;
}) {
  if (pages <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams(query);
    if (target > 1) params.set("page", String(target));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };
  const linkClass =
    "inline-flex items-center gap-1.5 rounded-sm border border-border px-4 py-2 text-sm text-ivory transition-colors hover:border-gold-muted hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  return (
    <nav aria-label={labels.pagination} className="flex items-center justify-between gap-4 pt-4">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={linkClass}>
          <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
          {labels.previous}
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-grey">
        {fill(labels.pageOf, { page, pages })}
      </p>
      {page < pages ? (
        <Link href={href(page + 1)} rel="next" className={linkClass}>
          {labels.next}
          <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
