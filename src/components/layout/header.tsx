import Link from "next/link";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { Dictionary, Locale } from "@/i18n";
import { categoryPath } from "@/lib/urls";
import { listPublicCategories } from "@/server/public/articles";

import { AccountMenu } from "./account-menu";
import { HeaderSearch } from "./header-search";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";

/** Masthead: logo, sections (from the database, in sortOrder), search, language, account (sign in or avatar menu, loaded in the browser), mobile menu. */
export async function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const sections = (await listPublicCategories()).map((category) => ({
    href: categoryPath(locale, category.slug),
    label: locale === "en" ? category.nameEn : category.nameUr,
  }));

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-black/90 backdrop-blur supports-[backdrop-filter]:bg-black/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:h-20 sm:gap-6 sm:px-6 lg:px-8">
        <MobileMenu
          locale={locale}
          sections={sections}
          labels={{ nav: dict.nav, about: dict.footer.about, search: dict.search, theme: dict.theme }}
        />
        <Logo href={`/${locale}`} label={dict.nav.homeLink} />

        <nav aria-label={dict.nav.primary} className="hidden min-w-0 md:block">
          <ul className="flex items-center gap-6 overflow-x-auto text-sm no-scrollbar">
            {sections.map((section) => (
              <li key={section.href}>
                <Link
                  href={section.href}
                  className="inline-block py-2 whitespace-nowrap text-grey transition-colors hover:text-gold-soft focus-visible:text-gold-soft focus-visible:outline-none"
                >
                  {section.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-1 sm:gap-3">
          <HeaderSearch locale={locale} labels={{ ...dict.search, ...dict.nav }} />
          {/* Phones choose the theme in the menu (the header has no room). */}
          <ThemeToggle labels={dict.theme} className="hidden sm:inline-flex" />
          <LanguageSwitcher locale={locale} label={dict.nav.language} />
          <AccountMenu locale={locale} labels={dict.nav} />
        </div>
      </div>
    </header>
  );
}
