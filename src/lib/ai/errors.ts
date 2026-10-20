/**
 * AI error types, shared by the server (providers, route) and the client
 * (friendly messages + Retry). Pure module: safe to import anywhere.
 */

export const AI_ERROR_CODES = [
  "not_configured", // no usable provider (no key, or mock in production)
  "config", // key rejected or model not found
  "rate_limited", // too many requests (ours or the provider's)
  "quota", // provider quota / billing exhausted
  "safety", // the provider blocked the prompt or the response
  "invalid_output", // response unusable (bad JSON, wrong language, empty)
  "timeout",
  "network",
  "unavailable", // provider temporarily down (5xx)
  "aborted", // the admin pressed Stop
  "bad_request", // our input failed validation
  "unknown",
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  not_configured: "AI isn't configured on this site yet.",
  config: "The AI provider rejected the configuration. Check GEMINI_API_KEY and GEMINI_MODEL.",
  rate_limited: "Too many AI requests in a short time. Wait a moment, then try again.",
  quota: "The AI quota for this API key is used up. Try again later or check your Google AI Studio plan.",
  safety: "The AI declined this request for safety reasons. Try rephrasing it.",
  invalid_output: "The AI returned something we couldn't use. Please try again.",
  timeout: "The AI took too long to respond. Please try again.",
  network: "Couldn't reach the AI service. Check your connection and try again.",
  unavailable: "The AI service is temporarily unavailable. Please try again in a minute.",
  aborted: "Stopped.",
  bad_request: "That request wasn't valid. Check the inputs and try again.",
  unknown: "Something went wrong with the AI request. Please try again.",
};

/** Codes where pressing Retry can plausibly help. */
export function isRetryable(code: AiErrorCode) {
  return !["not_configured", "config", "bad_request"].includes(code);
}

export class AiError extends Error {
  readonly code: AiErrorCode;
  /** Seconds the caller should wait before retrying, when known. */
  readonly retryAfter?: number;

  constructor(code: AiErrorCode, message?: string, options?: { retryAfter?: number; cause?: unknown }) {
    super(message ?? AI_ERROR_MESSAGES[code], { cause: options?.cause });
    this.name = "AiError";
    this.code = code;
    this.retryAfter = options?.retryAfter;
  }
}

export function isAiErrorCode(value: unknown): value is AiErrorCode {
  return typeof value === "string" && (AI_ERROR_CODES as readonly string[]).includes(value);
}
