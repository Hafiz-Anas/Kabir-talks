import "server-only";

import { z } from "zod";

import { env } from "@/lib/env";

import { AI_CALLS_PER_MINUTE, aiStatus } from "./config";
import { AiError } from "./errors";
import { createGeminiProvider } from "./gemini";
import { parseJsonOutput } from "./json";
import { createMockProvider } from "./mock";
import { createRateLimiter } from "./rate-limit";
import type { AiProvider, AiRequest, AiTextResult } from "./types";

/**
 * The only entry point for model calls (admin AI now, reader AI in Phase 6).
 * Adds to every call: a timeout, Stop support (abort signal), a per-user
 * rate limit, typed errors, Zod-validated JSON, and logging that records
 * counts and error codes only, never prompts or article content.
 */

export { aiStatus } from "./config";
export type { AiCallKind } from "./types";

let provider: AiProvider | null | undefined;

export function getAiProvider(): AiProvider | null {
  if (provider !== undefined) return provider;
  if (aiStatus.mode === "gemini") provider = createGeminiProvider(env.GEMINI_API_KEY!, aiStatus.model!);
  else if (aiStatus.mode === "mock") provider = createMockProvider();
  else provider = null;
  return provider;
}

export type CallOptions = {
  /** Rate-limit key (the admin's user id). */
  userId: string;
  /** Aborted when the admin presses Stop (the HTTP request is cancelled). */
  signal?: AbortSignal;
  timeoutMs: number;
};

type Request = Omit<AiRequest, "signal">;

const limiter = createRateLimiter(AI_CALLS_PER_MINUTE);
const counts = new Map<string, number>();

function log(kind: string, outcome: string, startedAt: number) {
  const key = `${kind}:${outcome}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
  const line = `[ai] ${kind} ${outcome} ${Date.now() - startedAt}ms (count ${counts.get(key)})`;
  if (outcome === "ok" || outcome === "aborted") console.info(line);
  else console.warn(line);
}

/** Sets up the provider, rate limit and combined abort signal for one call. */
function begin(options: CallOptions) {
  const ai = getAiProvider();
  if (!ai) throw new AiError("not_configured");
  if (options.signal?.aborted) throw new AiError("aborted");

  const wait = limiter.take(options.userId);
  if (wait > 0) {
    throw new AiError(
      "rate_limited",
      `You've reached the limit of ${AI_CALLS_PER_MINUTE} AI requests per minute. Try again in ${wait}s.`,
      { retryAfter: wait },
    );
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

export async function generateText(request: Request, options: CallOptions): Promise<AiTextResult> {
  const startedAt = Date.now();
  const { ai, signal, end } = begin(options);
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
  const { ai, signal, end } = begin(options);
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
