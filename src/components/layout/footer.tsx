import { cacheLife } from "next/cache";

import { ComingSoon } from "@/components/coming-soon";
import type { Dictionary, Locale } from "@/i18n";

import { Logo } from "./logo";

// Placeholders: turn these into links when the real profiles exist.
const SOCIAL_LINKS = ["X", "Facebook", "YouTube", "Instagram"] as const;

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <footer className="mt-auto border-t border-border bg-obsidian">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr] lg:px-8">
        <div className="space-y-4">
          <Logo href={`/${locale}`} />
          <p className="max-w-sm text-sm text-grey">{dict.site.tagline}</p>
        </div>

        <nav aria-label={dict.footer.about} className="space-y-3 text-sm">
          <ul className="space-y-3">
            <li className="flex items-center gap-2 text-grey">
              {dict.footer.about}
              <ComingSoon label={dict.common.comingSoon} />
            </li>
            <li className="flex items-center gap-2 text-grey">
              {dict.footer.contact}
              <ComingSoon label={dict.common.comingSoon} />
            </li>
          </ul>
        </nav>

        <div className="space-y-3 text-sm">
          <p className="text-ivory">{dict.footer.follow}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2" lang="en" dir="ltr">
            {SOCIAL_LINKS.map((name) => (
              <li key={name} className="text-grey-dim" title={dict.common.comingSoon}>
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-grey-dim sm:px-6 lg:px-8">
          © <CurrentYear /> Kabir Talks. {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
