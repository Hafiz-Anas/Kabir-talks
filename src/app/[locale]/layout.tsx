import "../globals.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdsScript } from "@/components/ad-slot";
import { BreakingBar } from "@/components/breaking/breaking-bar";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { ThemeScript } from "@/components/theme/theme-script";
import { getDictionary, isLocale, localeDirection, locales } from "@/i18n";
import { env } from "@/lib/env";
import { fontVariables } from "@/lib/fonts";

/**
 * Public site root layout: sets <html lang/dir> per locale.
 * Unknown locales (e.g. /fr) hit notFound() below.
 */

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);

  return {
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    title: { default: dict.site.name, template: `%s · ${dict.site.name}` },
    description: dict.site.description,
    // Each page sets its own canonical, hreflang, Open Graph and Twitter tags (src/lib/seo.ts).
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <html lang={locale} dir={localeDirection[locale]} className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:bg-gold focus:px-3 focus:py-2 focus:text-black"
        >
          {dict.nav.skipToContent}
        </a>
        <Header locale={locale} dict={dict} />
        <BreakingBar locale={locale} labels={dict.breaking} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} dict={dict} />
        <AdsScript />
      </body>
    </html>
  );
}
