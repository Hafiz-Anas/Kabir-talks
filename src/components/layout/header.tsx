import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Dictionary, Locale } from "@/i18n";
import { NAV_CATEGORIES } from "@/lib/navigation";

import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const navLinks = NAV_CATEGORIES.map((category) => (
    <li key={category.slug}>
      <Link
        href={`/${locale}/${category.slug}`}
        className="inline-block py-2 whitespace-nowrap text-grey transition-colors hover:text-gold-soft focus-visible:text-gold-soft focus-visible:outline-none"
      >
        {dict.nav[category.labelKey]}
      </Link>
    </li>
  ));

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-black/90 backdrop-blur supports-[backdrop-filter]:bg-black/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:h-20 sm:gap-6 sm:px-6 lg:px-8">
        <Logo href={`/${locale}`} />

        <nav aria-label={dict.nav.primary} className="hidden md:block">
          <ul className="flex items-center gap-6 text-sm">{navLinks}</ul>
        </nav>

        <div className="ms-auto flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher locale={locale} label={dict.nav.language} />
          <Button asChild variant="outline" size="sm" className="shrink-0 border-gold-muted bg-transparent hover:border-gold hover:bg-transparent hover:text-gold-soft">
            <Link href={`/login?next=/${locale}`}>{dict.nav.signIn}</Link>
          </Button>
        </div>
      </div>

      {/* Mobile: sections bar under the masthead (no JS menu needed). */}
      <nav aria-label={dict.nav.primary} className="border-t border-border md:hidden">
        <ul className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto px-4 text-sm no-scrollbar">
          {navLinks}
        </ul>
      </nav>
    </header>
  );
}
