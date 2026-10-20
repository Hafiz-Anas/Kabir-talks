/**
 * Checks that model output is in the expected writing system: Urdu must be
 * Perso-Arabic script (not Hindi/Devanagari or Roman Urdu), English must be
 * Latin. Pure module.
 */

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u;
const LATIN = /[A-Za-zÀ-ɏ]/u;
const LETTER = /\p{L}/u;

/** Placeholders, link targets and bare URLs are not prose: ignore them. */
function prose(text: string) {
  return text
    .replace(/\[\[KT_BLOCK_\d+\]\]/g, " ")
    .replace(/\]\([^)]*\)/g, "] ")
    .replace(/(?:https?:\/\/|mailto:)\S+/g, " ");
}

export function scriptShare(text: string) {
  let letters = 0;
  let arabic = 0;
  let latin = 0;
  for (const char of prose(text)) {
    if (!LETTER.test(char)) continue;
    letters++;
    if (ARABIC.test(char)) arabic++;
    else if (LATIN.test(char)) latin++;
  }
  return { letters, arabic: letters ? arabic / letters : 0, latin: letters ? latin / letters : 0 };
}

/** Minimum share of letters in the expected script. Leaves room for names and acronyms. */
export const SCRIPT_THRESHOLD = 0.75;
const TOO_SHORT_TO_JUDGE = 12;

export function isExpectedScript(text: string, locale: "en" | "ur"): boolean {
  const share = scriptShare(text);
  if (share.letters < TOO_SHORT_TO_JUDGE) return true;
  return (locale === "ur" ? share.arabic : share.latin) >= SCRIPT_THRESHOLD;
}

export const WRONG_SCRIPT_MESSAGE: Record<"en" | "ur", string> = {
  ur: "The AI didn't answer in Urdu script (it looked like Hindi or Roman Urdu). Nothing was changed. Please try again.",
  en: "The AI didn't answer in English. Nothing was changed. Please try again.",
};
