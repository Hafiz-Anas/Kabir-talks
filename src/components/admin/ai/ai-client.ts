"use client";

import { AI_ERROR_MESSAGES, type AiErrorCode, isAiErrorCode } from "@/lib/ai/errors";
import type { AiEvent, AiResults, AiTaskInput, AiTaskName } from "@/lib/ai/tasks";

/**
 * Browser side of POST /api/admin/ai. The browser only ever talks to our own
 * server; the Gemini key and Google endpoints stay server-side.
 */

export class AiClientError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message?: string,
    readonly retryAfter?: number,
  ) {
    super(message ?? AI_ERROR_MESSAGES[code]);
    this.name = "AiClientError";
  }
}

export type RunOptions = {
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
  onProgress?: (done: number, total: number) => void;
};

export async function runAiTask<T extends AiTaskName>(
  input: Extract<AiTaskInput, { task: T }>,
  options: RunOptions = {},
): Promise<AiResults[T]> {
  let response: Response;
  try {
    response = await fetch("/api/admin/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: options.signal,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    if (options.signal?.aborted) throw new AiClientError("aborted");
    throw new AiClientError("network");
  }

  if (response.type === "opaqueredirect" || response.status === 401) {
    throw new AiClientError("bad_request", "Your session has ended. Sign in again, then retry.");
  }
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: unknown; message?: string } } | null;
    const code = isAiErrorCode(body?.error?.code) ? body.error.code : response.status === 404 ? "bad_request" : "unknown";
    throw new AiClientError(code, body?.error?.message);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const event = JSON.parse(line) as AiEvent;
        if (event.type === "delta") options.onDelta?.(event.text);
        else if (event.type === "progress") options.onProgress?.(event.done, event.total);
        else if (event.type === "error") throw new AiClientError(event.code, event.message, event.retryAfter);
        else if (event.type === "result") return event.data as AiResults[T];
      }
    }
  } catch (error) {
    if (error instanceof AiClientError) throw error;
    if (options.signal?.aborted) throw new AiClientError("aborted");
    throw new AiClientError("network");
  } finally {
    reader.releaseLock();
  }
  if (options.signal?.aborted) throw new AiClientError("aborted");
  throw new AiClientError("network", "The AI response was cut off. Please try again.");
}
