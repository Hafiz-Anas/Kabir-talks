"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { type Locale, localeLabel, locales, switchLocalePath } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** Switches between /en/... and /ur/... while staying on the same page. */
export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="flex items-center gap-1 text-sm">
      {locales.map((target) => {
        const active = target === locale;
        return (
          <Link
            key={target}
            href={switchLocalePath(pathname, target)}
            lang={target}
            hrefLang={target}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-sm px-2 py-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              target === "ur" ? "font-urdu leading-loose" : "font-sans",
              // On phones only the *other* language is shown, to save header space.
              active ? "hidden text-gold sm:inline-block" : "text-grey hover:text-ivory",
            )}
          >
            {localeLabel[target]}
          </Link>
        );
      })}
    </nav>
  );
}
