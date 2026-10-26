/**
 * Provider interface. Implementations: ./gemini.ts (real) and ./mock.ts
 * (deterministic, development only). Callers go through ./index.ts, which
 * adds timeouts, abort, rate limiting, error mapping and logging.
 */

/** What a model call is for: drives prompt choice, limits, and mock output. */
export type AiCallKind =
  | "ping"
  | "draft-body"
  | "draft-meta"
  | "translate-chunk"
  | "translate-fields"
  | "suggest-headlines"
  | "suggest-excerpt"
  | "suggest-seo-title"
  | "suggest-seo-description"
  | "suggest-tags"
  | "suggest-slug"
  | "edit"
  // Phase 6 reader AI
  | "summary"
  | "ask"
  | "speech";

export type AiRequest = {
  kind: AiCallKind;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature?: number;
  /** JSON Schema for structured output (generateJson only). */
  jsonSchema?: Record<string, unknown>;
  /** Structured copy of the inputs. Only the mock provider reads it. */
  mockInput?: unknown;
  /** Combined user-abort + timeout signal, set by ./index.ts. */
  signal: AbortSignal;
};

export type AiTextResult = {
  text: string;
  /** True when the model stopped at the output token limit. */
  truncated: boolean;
};

/** Text-to-speech for one chunk of an article (Phase 6 "Listen"). */
export type SpeechRequest = {
  kind: "speech";
  text: string;
  voice: string;
  signal: AbortSignal;
};

/** 16-bit signed little-endian mono PCM. */
export type SpeechResult = { pcm: Uint8Array; sampleRate: number };

export interface AiProvider {
  readonly name: "gemini" | "mock";
  readonly model: string;
  /** Text-to-speech model ("mock" for the mock provider). */
  readonly ttsModel: string;
  /** Throws AiError. */
  generate(request: AiRequest): Promise<AiTextResult>;
  /** Yields text deltas. Throws AiError. */
  stream(request: AiRequest): AsyncIterable<string>;
  /** Speech audio for one chunk of text. Throws AiError. */
  speak(request: SpeechRequest): Promise<SpeechResult>;
}
