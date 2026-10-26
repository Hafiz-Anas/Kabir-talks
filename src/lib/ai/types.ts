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
  | "ask";

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

export interface AiProvider {
  readonly name: "gemini" | "mock";
  readonly model: string;
  /** Throws AiError. */
  generate(request: AiRequest): Promise<AiTextResult>;
  /** Yields text deltas. Throws AiError. */
  stream(request: AiRequest): AsyncIterable<string>;
}
