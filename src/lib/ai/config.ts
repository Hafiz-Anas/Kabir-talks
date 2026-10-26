import { env } from "@/lib/env";

/**
 * Which AI provider is active, derived from env:
 *
 *   AI_PROVIDER     GEMINI_API_KEY   NODE_ENV        → mode
 *   unset/gemini    set              any             → "gemini"
 *   unset/gemini    unset            any             → "off"
 *   mock            any              development     → "mock"
 *   mock            any              production      → "off"  (mock never runs in production builds)
 *
 * Plain module (no "server-only") so scripts can import it, but it reads
 * server env: never import it from a Client Component. Pass `AiStatus` down.
 */

/** Default model. Checked against https://ai.google.dev/gemini-api/docs/models on 2026-10-20 (stable). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

/**
 * Default text-to-speech model and voice for "Listen". Checked against
 * https://ai.google.dev/gemini-api/docs/speech-generation on 2026-10-26
 * (model list and the 30 prebuilt voices; Kore is one of them).
 */
export const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";
export const DEFAULT_GEMINI_TTS_VOICE = "Kore";
export const TTS_VOICE = env.GEMINI_TTS_VOICE ?? DEFAULT_GEMINI_TTS_VOICE;

export type AiMode = "gemini" | "mock" | "off";

export type AiStatus = {
  mode: AiMode;
  /** Model code for gemini, "mock" for mock, null when off. */
  model: string | null;
  /** Text-to-speech model for "Listen" (Phase 6), same rules. */
  ttsModel: string | null;
  /** Why AI is off (shown on the dashboard), null when on. */
  reason: string | null;
};

function resolve(): AiStatus {
  const requested = env.AI_PROVIDER ?? "gemini";

  if (requested === "mock") {
    if (env.NODE_ENV === "production") {
      return { mode: "off", model: null, ttsModel: null, reason: "AI_PROVIDER=mock is ignored in production builds." };
    }
    return { mode: "mock", model: "mock", ttsModel: "mock", reason: null };
  }

  if (!env.GEMINI_API_KEY) {
    return { mode: "off", model: null, ttsModel: null, reason: "GEMINI_API_KEY is not set." };
  }
  return {
    mode: "gemini",
    model: env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
    ttsModel: env.GEMINI_TTS_MODEL ?? DEFAULT_GEMINI_TTS_MODEL,
    reason: null,
  };
}

export const aiStatus: AiStatus = resolve();

/** Per-admin cap on AI model calls per minute (database-backed; src/server/ai/limits.ts). */
export const AI_CALLS_PER_MINUTE = env.AI_RATE_LIMIT_PER_MINUTE ?? 30;
/** Global cap on model calls per day, all features together (Phase 6). */
export const AI_DAILY_LIMIT = env.AI_DAILY_LIMIT ?? 1000;
/** "Ask this article" questions per signed-in reader per day (Phase 6). */
export const READER_ASK_PER_DAY = env.READER_AI_ASK_PER_DAY ?? 20;
/** Reader burst limits per minute: Ask per reader, on-demand summaries per IP. */
export const READER_CALLS_PER_MINUTE = 6;
