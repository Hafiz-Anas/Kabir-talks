import type { Locale } from "./config";
import { en, type Dictionary } from "./en";
import { ur } from "./ur";

const dictionaries: Record<Locale, Dictionary> = { en, ur };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Fills {placeholders} in a dictionary string: fill(dict.common.minRead, { minutes: 4 }). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** What an article card needs: reading time and the bookmark button's strings. */
export function cardLabels(dict: Dictionary) {
  return { minRead: dict.common.minRead, bookmarks: dict.bookmarks, opinion: dict.opinion.label };
}
export type CardLabels = ReturnType<typeof cardLabels>;

export type { Dictionary };
export * from "./config";
