import "server-only";

import { ApiError, type GenerateContentConfig, type GenerateContentResponse, GoogleGenAI, ThinkingLevel } from "@google/genai";

import { AiError } from "./errors";
import { TTS_SAMPLE_RATE, wavToPcm } from "./speech";
import type { AiProvider, AiRequest } from "./types";

/**
 * Gemini provider (Google Gen AI SDK). Server-only: the API key never leaves
 * the server, and the browser never talks to Google directly.
 */

const BLOCKING_FINISH = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"]);

export function createGeminiProvider(apiKey: string, model: string, ttsModel: string): AiProvider {
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
    ttsModel,

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

    /**
     * Text-to-speech through the Interactions API, as documented on
     * https://ai.google.dev/gemini-api/docs/speech-generation (2026-10-26):
     * raw 16-bit PCM ("audio/l16", 24 kHz mono) so chunks can be joined. A WAV
     * reply is unwrapped too, in case the API ignores the requested format.
     */
    async speak(request) {
      try {
        const interaction = await client.interactions.create(
          {
            model: ttsModel,
            input: [{ type: "user_input", content: [{ type: "text", text: request.text }] }],
            response_format: { type: "audio", mime_type: "audio/l16", sample_rate: TTS_SAMPLE_RATE },
            generation_config: { speech_config: [{ voice: request.voice }] },
          },
          { fetchOptions: { signal: request.signal } },
        );
        const audio = interaction.output_audio;
        if (!audio?.data) throw new AiError("invalid_output", "The AI returned no audio. Please try again.");
        const bytes = Uint8Array.from(Buffer.from(audio.data, "base64"));
        if (audio.mime_type?.includes("wav")) {
          const wav = wavToPcm(bytes);
          if (!wav) throw new AiError("invalid_output", "The AI returned audio in a format we can't use.");
          return wav;
        }
        return { pcm: bytes, sampleRate: audio.sample_rate ?? TTS_SAMPLE_RATE };
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
  // The Interactions client (text-to-speech) throws its own error class with an HTTP status.
  const status = (error as { status?: unknown })?.status;
  if (typeof status === "number") {
    if (status === 429) return new AiError("rate_limited", undefined, { cause: error });
    if (status === 401 || status === 403 || status === 404) return new AiError("config", undefined, { cause: error });
    if (status === 400) return new AiError("bad_request", undefined, { cause: error });
    if (status >= 500) return new AiError("unavailable", undefined, { cause: error });
  }
  if (error instanceof TypeError || (error as { code?: string })?.code === "ECONNRESET") {
    return new AiError("network", undefined, { cause: error });
  }
  return new AiError("unknown", undefined, { cause: error });
}
