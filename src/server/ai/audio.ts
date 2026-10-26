import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiAudio } from "@/db/schema";
import { locales, type Locale } from "@/i18n/config";
import { type CallOptions, generateSpeech, getAiProvider } from "@/lib/ai";
import { AI_CALLS_PER_MINUTE, TTS_VOICE } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/errors";
import type { AudioStatus } from "@/lib/ai/reader";
import {
  CHUNK_PAUSE_MS,
  MAX_AUDIO_BYTES,
  pcmDurationMs,
  pcmToWav,
  SERVER_TTS_LOCALES,
  silence,
  speechParagraphs,
  splitForSpeech,
} from "@/lib/ai/speech";
import { audioPublicUrl } from "@/lib/content/urls";
import { env } from "@/lib/env";
import { features } from "@/lib/features";

import { articleAudio } from "../storage";
import { acquireLease, releaseLease } from "./jobs";
import { takeMinuteLimit } from "./limits";
import { type ArticleSource, loadArticleSource } from "./summaries";

/**
 * "Listen" audio (Phase 6). Generated ONLY from the admin editor ("Generate
 * audio"), never by a reader: one WAV per article + language in the
 * article-audio bucket, tracked in ai_audio. Long articles are spoken in
 * chunks (one model call each) and joined with a short pause.
 *
 * Audio made from an older text (sourceHash) is out of date: readers are not
 * offered it, and the editor shows "Out of date" until it is regenerated.
 */

const LANGUAGE: Record<Locale, string> = { en: "English", ur: "Urdu" };

async function findAudio(articleId: string, locale: Locale) {
  const [row] = await db
    .select()
    .from(aiAudio)
    .where(and(eq(aiAudio.articleId, articleId), eq(aiAudio.locale, locale)))
    .limit(1);
  return row ?? null;
}

const urlOf = (path: string) => audioPublicUrl(env.NEXT_PUBLIC_SUPABASE_URL, path);

/** Reader endpoint: the current audio for a published article's language, or null. */
export async function currentAudio(source: ArticleSource) {
  if (!features.storageEnabled) return null;
  const row = await findAudio(source.id, source.locale);
  const url = row && row.sourceHash === source.hash ? urlOf(row.path) : null;
  return url && row ? { url, durationMs: row.durationMs } : null;
}

/** Admin editor: audio state per language. */
export async function getAudioStatuses(articleId: string): Promise<Record<Locale, AudioStatus>> {
  const entries = await Promise.all(
    locales.map(async (locale): Promise<[Locale, AudioStatus]> => {
      const [source, row] = await Promise.all([loadArticleSource(articleId, locale, { publishedOnly: false }), findAudio(articleId, locale)]);
      const file = {
        url: row && features.storageEnabled ? urlOf(row.path) : null,
        durationMs: row?.durationMs ?? null,
        bytes: row?.bytes ?? null,
        generatedAt: row?.createdAt.toISOString() ?? null,
      };
      if (!SERVER_TTS_LOCALES[locale]) return [locale, { state: "unsupported", ...file }];
      if (!source) return [locale, { state: "unavailable", ...file }];
      if (!row) return [locale, { state: "missing", ...file }];
      return [locale, { state: row.sourceHash === source.hash ? "ready" : "stale", ...file }];
    }),
  );
  return Object.fromEntries(entries) as Record<Locale, AudioStatus>;
}

/** A crashed generation's lease is taken over after this. */
const LEASE_SECONDS = 600;
/** Chunks spoken at the same time (keeps long articles inside the route's time limit). */
const PARALLEL_CHUNKS = 2;

/**
 * Generates (or regenerates) the audio for one language of the SAVED article.
 * Admin only: called from the admin AI route. Reports progress per chunk.
 * Throws AiError; on any failure nothing is uploaded or changed.
 */
export async function generateAudio(
  articleId: string,
  locale: Locale,
  options: Pick<CallOptions, "rateKey" | "signal"> & { onProgress?: (done: number, total: number) => void },
) {
  if (!getAiProvider()) throw new AiError("not_configured");
  if (!SERVER_TTS_LOCALES[locale]) {
    throw new AiError(
      "bad_request",
      `Gemini text-to-speech doesn't support ${LANGUAGE[locale]} yet, so ${LANGUAGE[locale]} readers use their browser's own voice when it has one.`,
    );
  }
  if (!features.storageEnabled) {
    throw new AiError("bad_request", "Audio needs Supabase Storage. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (README → Supabase Storage).");
  }
  const source = await loadArticleSource(articleId, locale, { publishedOnly: false });
  if (!source) throw new AiError("bad_request", `Add a ${LANGUAGE[locale]} title and body, and save, before generating its audio.`);

  // One job is one request against the per-minute limit; each chunk still counts against the daily cap.
  if (options.rateKey) {
    const { allowed, retryAfter } = await takeMinuteLimit(options.rateKey, AI_CALLS_PER_MINUTE);
    if (!allowed) throw new AiError("rate_limited", `Too many AI requests in the last minute. Try again in ${retryAfter}s.`, { retryAfter });
  }

  const key = `audio:${articleId}:${locale}`;
  if (!(await acquireLease(key, LEASE_SECONDS))) {
    throw new AiError("bad_request", `${LANGUAGE[locale]} audio is already being generated. Wait for it to finish.`);
  }
  try {
    const chunks = splitForSpeech(speechParagraphs(source.text));
    const parts: Uint8Array[] = new Array(chunks.length);
    let sampleRate = 0;
    let done = 0;
    let next = 0;
    options.onProgress?.(0, chunks.length);

    const worker = async () => {
      while (next < chunks.length) {
        const index = next++;
        const result = await generateSpeech(chunks[index], { rateKey: null, signal: options.signal, feature: "listen", timeoutMs: 120_000 });
        if (sampleRate && result.sampleRate !== sampleRate) throw new AiError("invalid_output", "The AI returned audio in mixed formats. Please try again.");
        sampleRate = result.sampleRate;
        parts[index] = result.pcm;
        options.onProgress?.(++done, chunks.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL_CHUNKS, chunks.length) }, worker));

    const pause = silence(CHUNK_PAUSE_MS, sampleRate);
    const pcm = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0) + pause.length * (parts.length - 1));
    let offset = 0;
    parts.forEach((part, i) => {
      if (i > 0) {
        pcm.set(pause, offset);
        offset += pause.length;
      }
      pcm.set(part, offset);
      offset += part.length;
    });
    const wav = pcmToWav(pcm, sampleRate);
    if (wav.length > MAX_AUDIO_BYTES) {
      throw new AiError("bad_request", "This article is too long for one audio file (over 50 MB). Readers can still use their browser's voice.");
    }

    const path = `audio/${articleId}/${locale}-${source.hash.slice(0, 16)}.wav`;
    const { error } = await articleAudio().upload(path, wav, { contentType: "audio/wav", cacheControl: "31536000", upsert: true });
    if (error) {
      console.error("[ai] audio upload failed", error.name);
      throw new AiError("unavailable", "The audio was generated but couldn't be saved to Storage. Check that the article-audio bucket exists (npm run storage:setup).");
    }

    const previous = await findAudio(articleId, locale);
    const values = {
      path,
      bytes: wav.length,
      durationMs: pcmDurationMs(pcm.length, sampleRate),
      voice: getAiProvider()?.name === "mock" ? "mock" : TTS_VOICE,
      sourceHash: source.hash,
      sourceUpdatedAt: source.updatedAt,
      createdAt: new Date(),
    };
    await db
      .insert(aiAudio)
      .values({ articleId, locale, ...values })
      .onConflictDoUpdate({ target: [aiAudio.articleId, aiAudio.locale], set: values });
    if (previous && previous.path !== path) await removeAudioFiles([previous.path]);
    return { source };
  } finally {
    await releaseLease(key);
  }
}

/** Best effort: a leftover file only costs storage, so failures are logged, not thrown. */
export async function removeAudioFiles(paths: string[]) {
  if (!paths.length || !features.storageEnabled) return;
  try {
    const { error } = await articleAudio().remove(paths);
    if (error) console.warn("[ai] audio cleanup failed", error.name);
  } catch {
    console.warn("[ai] audio cleanup failed");
  }
}

/** Paths of an article's audio files (to delete them with the article). */
export async function audioPathsOf(articleId: string) {
  const rows = await db.select({ path: aiAudio.path }).from(aiAudio).where(eq(aiAudio.articleId, articleId));
  return rows.map((row) => row.path);
}
