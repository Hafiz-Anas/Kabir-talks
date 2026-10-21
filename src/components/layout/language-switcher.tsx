"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { type Locale, localeLabel, locales, switchLocalePath } from "@/i18n/config";
import { cn } from "@/lib/utils";

import { useLocaleAlternate } from "./locale-alternates";

/**
 * Switches between /en/... and /ur/... while staying on the same page.
 * Pages can override the target (see locale-alternates.tsx), e.g. an
 * English-only article sends the Urdu link to the Urdu homepage.
 */
export function LanguageSwitcher({
  locale,
  label,
  showActive = "sm",
  className,
}: {
  locale: Locale;
  label: string;
  /** When the current language is shown too: always, or from the sm breakpoint (header). */
  showActive?: "always" | "sm";
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className={cn("flex items-center gap-1 text-sm", className)}>
      {locales.map((target) => (
        <LocaleLink key={target} target={target} active={target === locale} pathname={pathname} showActive={showActive} />
      ))}
    </nav>
  );
}

function LocaleLink({
  target,
  active,
  pathname,
  showActive,
}: {
  target: Locale;
  active: boolean;
  pathname: string;
  showActive: "always" | "sm";
}) {
  const override = useLocaleAlternate(pathname, target);
  return (
    <Link
      href={override ?? switchLocalePath(pathname, target)}
      lang={target}
      hrefLang={target}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-sm px-2 py-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        target === "ur" ? "font-urdu text-base" : "font-sans",
        active ? "text-gold" : "text-grey hover:text-ivory",
        // In the header on phones only the *other* language is shown, to save space.
        active && showActive === "sm" && "hidden sm:inline-block",
      )}
    >
      {localeLabel[target]}
    </Link>
  );
}
