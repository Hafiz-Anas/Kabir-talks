import { cacheLife } from "next/cache";
import Link from "next/link";

import { newsletterLabels } from "@/components/newsletter/labels";
import { SignupBox } from "@/components/newsletter/signup-box";
import type { Dictionary, Locale } from "@/i18n";
import { features } from "@/lib/features";
import { categoryPath } from "@/lib/urls";
import { listPublicCategories } from "@/server/public/articles";

import { Logo } from "./logo";

// Placeholders: turn these into links when the real profiles exist.
const SOCIAL_LINKS = ["X", "Facebook", "YouTube", "Instagram"] as const;

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

const linkClass = "text-grey transition-colors hover:text-gold-soft focus-visible:text-gold-soft focus-visible:outline-none";

export async function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const categories = await listPublicCategories();

  return (
    <footer className="mt-auto border-t border-border bg-obsidian">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr] lg:px-8">
        <div className="space-y-4 sm:col-span-2 md:col-span-1">
          <Logo href={`/${locale}`} label={dict.nav.homeLink} />
          <p className="max-w-sm text-sm text-grey">{dict.site.tagline}</p>
          {features.newsletterEnabled && (
            <div className="max-w-sm pt-2">
              <SignupBox locale={locale} labels={newsletterLabels(dict)} variant="footer" />
            </div>
          )}
        </div>

        <nav aria-label={dict.footer.sections} className="space-y-3 text-sm">
          <p className="text-ivory">{dict.footer.sections}</p>
          <ul className="space-y-3">
            {categories.map((category) => (
              <li key={category.id}>
                <Link href={categoryPath(locale, category.slug)} className={linkClass}>
                  {locale === "en" ? category.nameEn : category.nameUr}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Kabir Talks" className="space-y-3 text-sm">
          <p className="text-ivory" lang="en" dir="ltr">
            Kabir Talks
          </p>
          <ul className="space-y-3">
            {(
              [
                ["about", dict.footer.about],
                ["contact", dict.footer.contact],
                ["privacy", dict.footer.privacy],
                ["terms", dict.footer.terms],
              ] as const
            ).map(([path, label]) => (
              <li key={path}>
                <Link href={`/${locale}/${path}`} className={linkClass}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-3 text-sm">
          <p className="text-ivory">{dict.footer.follow}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2" lang="en" dir="ltr">
            {SOCIAL_LINKS.map((name) => (
              <li key={name} className="text-grey" title={dict.common.comingSoon}>
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-grey sm:px-6 lg:px-8">
          © <CurrentYear /> Kabir Talks. {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
