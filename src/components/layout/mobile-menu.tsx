"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { SearchForm } from "@/components/search-form";
import { ThemeChoice, type ThemeLabels } from "@/components/theme/theme-toggle";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Dictionary, Locale } from "@/i18n";

import { AccountLinks, type AccountLabels } from "./account-menu";
import { LanguageSwitcher } from "./language-switcher";

/** Phone/tablet menu: sections, About, search, language, theme and account. Hidden from md up. */
export function MobileMenu({
  locale,
  sections,
  labels,
}: {
  locale: Locale;
  sections: { href: string; label: string }[];
  labels: {
    nav: Pick<Dictionary["nav"], "menu" | "openMenu" | "closeMenu" | "sections" | "language" | "home" | "signUp"> &
      AccountLabels;
    about: string;
    search: Dictionary["search"];
    theme: ThemeLabels;
  };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close after navigating (links and the search form inside the sheet change the pathname).
  const [openedOn, setOpenedOn] = useState(pathname);
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    setOpen(false);
  }

  const linkClass =
    "block rounded-sm py-2.5 text-lg text-ivory transition-colors hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={labels.nav.openMenu}
        className="grid size-10 shrink-0 place-items-center rounded-sm text-grey transition-colors hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:hidden"
      >
        <Menu aria-hidden className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className="w-[85vw] max-w-sm gap-0 overflow-y-auto border-border bg-black p-0 rtl:data-[state=closed]:slide-out-to-left rtl:data-[state=open]:slide-in-from-left"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <SheetTitle className="text-xl text-ivory">{labels.nav.menu}</SheetTitle>
          <SheetClose
            aria-label={labels.nav.closeMenu}
            className="grid size-10 place-items-center rounded-sm text-grey hover:text-ivory focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X aria-hidden className="size-5" />
          </SheetClose>
        </div>

        <div className="space-y-8 px-5 py-6">
          <SearchForm locale={locale} labels={labels.search} />

          <nav aria-label={labels.nav.sections}>
            <p className="mb-2 text-xs tracking-[0.12em] text-gold uppercase">{labels.nav.sections}</p>
            <ul className="divide-y divide-border">
              <li>
                <Link href={`/${locale}`} className={linkClass}>
                  {labels.nav.home}
                </Link>
              </li>
              {sections.map((section) => (
                <li key={section.href}>
                  <Link href={section.href} className={linkClass}>
                    {section.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={`/${locale}/about`} className={linkClass}>
                  {labels.about}
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <p className="mb-2 text-xs tracking-[0.12em] text-gold uppercase">{labels.nav.language}</p>
            <LanguageSwitcher locale={locale} label={labels.nav.language} showActive="always" className="-ms-2 text-base" />
          </div>

          <div>
            <p className="mb-2 text-xs tracking-[0.12em] text-gold uppercase">{labels.theme.label}</p>
            <ThemeChoice labels={labels.theme} />
          </div>

          <AccountLinks locale={locale} labels={labels.nav} linkClass={linkClass} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
