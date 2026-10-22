"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Locale } from "@/i18n";
import { cn } from "@/lib/utils";

/** Tabs between the reader's account and bookmarks pages. */
export function AccountNav({ locale, labels }: { locale: Locale; labels: { account: string; bookmarks: string; nav: string } }) {
  const pathname = usePathname();
  const items = [
    { href: `/${locale}/account`, label: labels.account },
    { href: `/${locale}/account/bookmarks`, label: labels.bookmarks },
  ];
  return (
    <nav aria-label={labels.nav} className="border-b border-border">
      <ul className="-mb-px flex gap-6">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-block border-b-2 py-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active ? "border-gold text-gold" : "border-transparent text-grey hover:text-ivory",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
