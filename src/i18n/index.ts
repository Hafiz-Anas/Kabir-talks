import type { Locale } from "./config";
import { en, type Dictionary } from "./en";
import { ur } from "./ur";

const dictionaries: Record<Locale, Dictionary> = { en, ur };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
export * from "./config";
