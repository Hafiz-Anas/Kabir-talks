"use client";

import { useSyncExternalStore } from "react";

/**
 * The browser's built-in speech (Web Speech API), the fallback when there is
 * no generated audio for the article's language. A "suitable" voice is one
 * whose language matches the page (en-*, ur-*). No network request: voices
 * come from the browser and the operating system.
 */

const matches = (voice: SpeechSynthesisVoice, locale: string) => voice.lang.replace("_", "-").toLowerCase().startsWith(`${locale}`);

/** The best voice for `locale`: a local (offline) one if there is one, else any match. */
export function pickVoice(locale: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((voice) => matches(voice, locale));
  return voices.find((voice) => voice.localService) ?? voices[0] ?? null;
}

function subscribe(onChange: () => void) {
  if (!("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", onChange);
}

/** True once the browser reports a voice for `locale` (voices can load a moment after the page). */
export function useBrowserVoice(locale: string) {
  return useSyncExternalStore(
    subscribe,
    () => pickVoice(locale) !== null,
    () => false,
  );
}
