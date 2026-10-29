import { cacheLife } from "next/cache";
import Link from "next/link";

import { newsletterLabels } from "@/components/newsletter/labels";
import { SignupBox } from "@/components/newsletter/signup-box";
import { SocialLinksRow } from "@/components/social/social-icons";
import type { Dictionary, Locale } from "@/i18n";
import { features } from "@/lib/features";
import { socialEntries } from "@/lib/social";
import { categoryPath } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { listPublicCategories } from "@/server/public/articles";
import { getSocialLinks } from "@/server/settings";

import { Logo } from "./logo";

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

const linkClass = "text-grey transition-colors hover:text-gold-soft focus-visible:text-gold-soft focus-visible:outline-none";

export async function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [categories, social] = await Promise.all([listPublicCategories(), getSocialLinks()]);
  // Phase 7C: the Follow column only exists when at least one link is set.
  const hasSocial = socialEntries(social).length > 0;

  return (
    <footer className="mt-auto border-t border-border bg-obsidian">
      <div
        className={cn(
          "mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:px-8",
          hasSocial ? "md:grid-cols-[2fr_1fr_1fr_1fr]" : "md:grid-cols-[2fr_1fr_1fr]",
        )}
      >
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

        {hasSocial && (
          <div className="space-y-3 text-sm" data-footer-follow>
            <p className="text-ivory">{dict.footer.follow}</p>
            <SocialLinksRow links={social} owner={dict.site.name} labels={dict.social} size="sm" />
          </div>
        )}
      </div>

      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-grey sm:px-6 lg:px-8">
          © <CurrentYear /> Kabir Talks. {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
