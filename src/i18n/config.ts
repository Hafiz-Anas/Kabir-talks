export const locales = ["en", "ur"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeDirection: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ur: "rtl",
};

/** Native names, shown in the language switcher. */
export const localeLabel: Record<Locale, string> = {
  en: "English",
  ur: "اردو",
};

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

/** Swap the locale segment of a path, keeping the rest: /en/sports → /ur/sports. */
export function switchLocalePath(pathname: string, target: Locale) {
  const segments = pathname.split("/");
  if (isLocale(segments[1])) {
    segments[1] = target;
    return segments.join("/") || `/${target}`;
  }
  return `/${target}`;
}
