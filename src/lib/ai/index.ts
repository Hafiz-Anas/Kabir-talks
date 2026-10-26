import "server-only";

import { z } from "zod";

import type { AiFeature } from "@/db/schema";
import { env } from "@/lib/env";
import { reserveDailyCall, takeMinuteLimit } from "@/server/ai/limits";

import { AI_CALLS_PER_MINUTE, aiStatus, TTS_VOICE } from "./config";
import { secondsUntilReset } from "./day";
import { AiError } from "./errors";
import { createGeminiProvider } from "./gemini";
import { parseJsonOutput } from "./json";
import { createMockProvider } from "./mock";
import type { AiProvider, AiRequest, AiTextResult, SpeechResult } from "./types";

/**
 * The only entry point for model calls (admin AI and reader AI). Adds to
 * every call: a timeout, Stop support (abort signal), a per-minute limit per
 * user, the global daily cap (both database-backed, src/server/ai/limits.ts),
 * typed errors, Zod-validated JSON, and logging that records counts and
 * error codes only, never prompts, questions, answers or article content.
 */

export { aiStatus } from "./config";
export type { AiCallKind } from "./types";

let provider: AiProvider | null | undefined;

export function getAiProvider(): AiProvider | null {
  if (provider !== undefined) return provider;
  if (aiStatus.mode === "gemini") provider = createGeminiProvider(env.GEMINI_API_KEY!, aiStatus.model!, aiStatus.ttsModel!);
  else if (aiStatus.mode === "mock") provider = createMockProvider();
  else provider = null;
  return provider;
}

export type CallOptions = {
  /**
   * Who the per-minute limit applies to: "admin:{id}", "reader:{id}" or
   * "ip:{ip}". Null for background jobs (publish-time summaries), which only
   * count against the daily cap.
   */
  rateKey: string | null;
  /** Calls per minute for rateKey (default AI_CALLS_PER_MINUTE, the admin limit). */
  perMinute?: number;
  /** Counted against the global daily cap, per feature. */
  feature: AiFeature;
  /** Aborted when the user presses Stop (the HTTP request is cancelled). */
  signal?: AbortSignal;
  timeoutMs: number;
};

type Request = Omit<AiRequest, "signal">;

const counts = new Map<string, number>();

function log(kind: string, outcome: string, startedAt: number) {
  const key = `${kind}:${outcome}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
  const line = `[ai] ${kind} ${outcome} ${Date.now() - startedAt}ms (count ${counts.get(key)})`;
  if (outcome === "ok" || outcome === "aborted") console.info(line);
  else console.warn(line);
}

/**
 * Checks the limits (per minute first, so a burst can't eat the daily cap),
 * then sets up the provider and the combined abort signal for one call.
 */
async function begin(options: CallOptions) {
  const ai = getAiProvider();
  if (!ai) throw new AiError("not_configured");
  if (options.signal?.aborted) throw new AiError("aborted");

  if (options.rateKey) {
    const perMinute = options.perMinute ?? AI_CALLS_PER_MINUTE;
    const { allowed, retryAfter } = await takeMinuteLimit(options.rateKey, perMinute);
    if (!allowed) {
      throw new AiError(
        "rate_limited",
        `You've reached the limit of ${perMinute} AI requests per minute. Try again in ${retryAfter}s.`,
        { retryAfter },
      );
    }
  }
  if (!(await reserveDailyCall(options.feature))) {
    throw new AiError("daily_limit", undefined, { retryAfter: secondsUntilReset() });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new AiError("timeout")), options.timeoutMs);
  const onAbort = () => controller.abort(new AiError("aborted"));
  options.signal?.addEventListener("abort", onAbort, { once: true });
  const end = () => {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  };
  return { ai, signal: controller.signal, end };
}

function normalize(error: unknown, signal: AbortSignal): AiError {
  if (signal.aborted && signal.reason instanceof AiError) return signal.reason;
  return error instanceof AiError ? error : new AiError("unknown", undefined, { cause: error });
}

/** Limit errors happen before the call starts: log them too. */
async function started(kind: string, options: CallOptions, startedAt: number) {
  try {
    return await begin(options);
  } catch (error) {
    log(kind, error instanceof AiError ? error.code : "unknown", startedAt);
    throw error;
  }
}

export async function generateText(request: Request, options: CallOptions): Promise<AiTextResult> {
  const startedAt = Date.now();
  const { ai, signal, end } = await started(request.kind, options, startedAt);
  try {
    const result = await ai.generate({ ...request, signal });
    if (!result.text.trim()) throw new AiError("invalid_output", "The AI returned an empty response. Please try again.");
    log(request.kind, "ok", startedAt);
    return result;
  } catch (error) {
    const aiError = normalize(error, signal);
    log(request.kind, aiError.code, startedAt);
    throw aiError;
  } finally {
    end();
  }
}

export async function* streamText(request: Request, options: CallOptions): AsyncGenerator<string> {
  const startedAt = Date.now();
  const { ai, signal, end } = await started(request.kind, options, startedAt);
  try {
    for await (const delta of ai.stream({ ...request, signal })) {
      if (signal.aborted) throw signal.reason;
      yield delta;
    }
    log(request.kind, "ok", startedAt);
  } catch (error) {
    const aiError = normalize(error, signal);
    log(request.kind, aiError.code, startedAt);
    throw aiError;
  } finally {
    end();
  }
}

/** Structured output: JSON Schema sent to the model, response validated with Zod. */
export async function generateJson<T>(request: Request, schema: z.ZodType<T>, options: CallOptions): Promise<T> {
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
  delete jsonSchema.$schema;
  const { text } = await generateText({ ...request, jsonSchema }, options);
  return parseJsonOutput(text, schema);
}

/** Speech audio for one chunk of text ("Listen"). Same limits, cap and logging as every other call. */
export async function generateSpeech(text: string, options: CallOptions): Promise<SpeechResult> {
  const startedAt = Date.now();
  const { ai, signal, end } = await started("speech", options, startedAt);
  try {
    const result = await ai.speak({ kind: "speech", text, voice: TTS_VOICE, signal });
    if (!result.pcm.length) throw new AiError("invalid_output", "The AI returned no audio. Please try again.");
    log("speech", "ok", startedAt);
    return result;
  } catch (error) {
    const aiError = normalize(error, signal);
    log("speech", aiError.code, startedAt);
    throw aiError;
  } finally {
    end();
  }
}
