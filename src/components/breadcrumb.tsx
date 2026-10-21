import Link from "next/link";

/** Home › Section trail. The separator is a chevron that points the reading direction. */
export function Breadcrumb({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  return (
    <nav aria-label={label} className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 text-grey">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-x-2">
            {index > 0 && (
              <span aria-hidden className="text-grey-dim">
                <span className="rtl:hidden">›</span>
                <span className="ltr:hidden">‹</span>
              </span>
            )}
            <Link href={item.href} className="transition-colors hover:text-gold-soft">
              {item.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
