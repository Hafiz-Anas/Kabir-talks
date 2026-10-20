import "server-only";

import { ApiError, type GenerateContentConfig, type GenerateContentResponse, GoogleGenAI, ThinkingLevel } from "@google/genai";

import { AiError } from "./errors";
import type { AiProvider, AiRequest } from "./types";

/**
 * Gemini provider (Google Gen AI SDK). Server-only: the API key never leaves
 * the server, and the browser never talks to Google directly.
 */

const BLOCKING_FINISH = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"]);

export function createGeminiProvider(apiKey: string, model: string): AiProvider {
  const client = new GoogleGenAI({ apiKey });

  const config = (request: AiRequest): GenerateContentConfig => ({
    systemInstruction: request.system,
    maxOutputTokens: request.maxOutputTokens,
    temperature: request.temperature,
    abortSignal: request.signal,
    // Editorial tasks need little reasoning; LOW keeps latency and cost down.
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    ...(request.jsonSchema
      ? { responseMimeType: "application/json", responseJsonSchema: request.jsonSchema }
      : {}),
  });

  return {
    name: "gemini",
    model,

    async generate(request) {
      try {
        const response = await client.models.generateContent({ model, contents: request.prompt, config: config(request) });
        const finish = checkResponse(response);
        return { text: response.text ?? "", truncated: finish === "MAX_TOKENS" };
      } catch (error) {
        throw toAiError(error, request.signal);
      }
    },

    async *stream(request) {
      try {
        const stream = await client.models.generateContentStream({ model, contents: request.prompt, config: config(request) });
        for await (const chunk of stream) {
          checkResponse(chunk);
          const text = chunk.text;
          if (text) yield text;
        }
      } catch (error) {
        throw toAiError(error, request.signal);
      }
    },
  };
}

/** Throws AiError("safety") for blocked prompts/responses; returns the finish reason. */
function checkResponse(response: GenerateContentResponse): string | undefined {
  if (response.promptFeedback?.blockReason) throw new AiError("safety");
  const finish = response.candidates?.[0]?.finishReason;
  if (finish && BLOCKING_FINISH.has(finish)) throw new AiError("safety");
  return finish;
}

function toAiError(error: unknown, signal: AbortSignal): AiError {
  if (error instanceof AiError) return error;
  if (signal.aborted) {
    // ./index.ts tells timeout and Stop apart via the abort reason.
    return signal.reason instanceof AiError ? signal.reason : new AiError("aborted");
  }
  if (error instanceof ApiError) {
    const message = error.message ?? "";
    if (error.status === 429) return new AiError(/quota|billing/i.test(message) ? "quota" : "rate_limited", undefined, { cause: error });
    if (error.status === 401 || error.status === 403 || error.status === 404) return new AiError("config", undefined, { cause: error });
    if (error.status === 400 && /api key|model/i.test(message)) return new AiError("config", undefined, { cause: error });
    if (error.status === 400) return new AiError("bad_request", undefined, { cause: error });
    if (error.status >= 500) return new AiError("unavailable", undefined, { cause: error });
    return new AiError("unknown", undefined, { cause: error });
  }
  if (error instanceof TypeError || (error as { code?: string })?.code === "ECONNRESET") {
    return new AiError("network", undefined, { cause: error });
  }
  return new AiError("unknown", undefined, { cause: error });
}
