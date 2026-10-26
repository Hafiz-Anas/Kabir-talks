/**
 * "Listen" (Phase 6) helpers shared by the server (generation) and the
 * browser (fallback speech). Pure module: no Node or DOM APIs.
 */

export type SpeechLocale = "en" | "ur";

/**
 * Languages the SERVER can turn into audio with Gemini text-to-speech.
 *
 * Checked against https://ai.google.dev/gemini-api/docs/speech-generation
 * (page updated 2026-10-12, read 2026-10-26): Gemini 3.8 Flash TTS lists
 * "over 130 languages", including Hindi, Punjabi, Sindhi and Kashmiri, but
 * NOT Urdu. So Urdu audio is never generated on the server; Urdu readers get
 * their browser's own Urdu voice when it has one, otherwise no Listen button.
 * If Google adds Urdu, flip `ur` to true (and test the pronunciation).
 */
export const SERVER_TTS_LOCALES: Record<SpeechLocale, boolean> = { en: true, ur: false };

/** Gemini TTS output: 16-bit signed little-endian mono PCM at 24 kHz (documented default). */
export const TTS_SAMPLE_RATE = 24_000;
/** Pause inserted between generated chunks (and paragraphs in the browser). */
export const CHUNK_PAUSE_MS = 350;
/** Text per TTS request. Long articles are generated in chunks and joined. */
export const SPEECH_CHUNK_CHARS = 1800;
/** Supabase's default per-file upload limit; the article-audio bucket uses it too. */
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

/** The text to read: title, then body paragraphs (images, embeds and captions are never in it). */
export function speechParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Splits text into pieces of at most `max` characters, at paragraph, then sentence, then word boundaries. */
export function splitForSpeech(paragraphs: string[], max = SPEECH_CHUNK_CHARS): string[] {
  const pieces: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= max) {
      pieces.push(paragraph);
      continue;
    }
    let current = "";
    for (const sentence of paragraph.split(/(?<=[.!?۔؟])\s+/)) {
      const parts = sentence.length > max ? (sentence.match(new RegExp(`.{1,${max}}(?=\\s|$)`, "gu")) ?? [sentence]) : [sentence];
      for (const part of parts) {
        if (current && current.length + 1 + part.length > max) {
          pieces.push(current);
          current = "";
        }
        current = current ? `${current} ${part.trim()}` : part.trim();
      }
    }
    if (current) pieces.push(current);
  }
  // Pack small paragraphs together so short articles cost one request.
  const chunks: string[] = [];
  for (const piece of pieces) {
    const last = chunks.at(-1);
    if (last !== undefined && last.length + 2 + piece.length <= max) chunks[chunks.length - 1] = `${last}\n\n${piece}`;
    else chunks.push(piece);
  }
  return chunks;
}

/** Silence of `ms` milliseconds as 16-bit PCM bytes. */
export function silence(ms: number, sampleRate = TTS_SAMPLE_RATE): Uint8Array {
  return new Uint8Array(Math.round((sampleRate * ms) / 1000) * 2);
}

/** Wraps 16-bit mono PCM in a WAV (RIFF) header. */
export function pcmToWav(pcm: Uint8Array, sampleRate = TTS_SAMPLE_RATE): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const view = new DataView(out.buffer);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

/** Reads 16-bit PCM and its sample rate out of a WAV file; null if it isn't 16-bit PCM WAV. */
export function wavToPcm(wav: Uint8Array): { pcm: Uint8Array; sampleRate: number } | null {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const tag = (offset: number) => String.fromCharCode(...wav.subarray(offset, offset + 4));
  if (wav.length < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let offset = 12;
  let sampleRate = 0;
  let bits = 0;
  while (offset + 8 <= wav.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt ") {
      sampleRate = view.getUint32(offset + 12, true);
      bits = view.getUint16(offset + 22, true);
    } else if (id === "data") {
      if (bits !== 16 || !sampleRate) return null;
      return { pcm: wav.subarray(offset + 8, Math.min(wav.length, offset + 8 + size)), sampleRate };
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

export const pcmDurationMs = (bytes: number, sampleRate = TTS_SAMPLE_RATE) => Math.round((bytes / 2 / sampleRate) * 1000);

/** Mock mode: a quiet tone instead of speech (about 1 s per 200 characters, at most 3 s per chunk). */
export function mockTone(text: string, sampleRate = TTS_SAMPLE_RATE): Uint8Array {
  const seconds = Math.min(3, Math.max(0.5, text.length / 200));
  const samples = Math.round(sampleRate * seconds);
  const out = new Uint8Array(samples * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples; i++) {
    const fade = Math.min(1, i / 2400, (samples - i) / 2400);
    view.setInt16(i * 2, Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 1800 * fade), true);
  }
  return out;
}
