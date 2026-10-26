import { z } from "zod";

import { type ArticleDoc, docToPlainText } from "@/lib/content/document";

/**
 * Reader AI (Phase 6) wire types and rules, shared by the route handlers
 * (/api/ai/*) and the article page's lazy-loaded panels. Pure module.
 */

export type ReaderLocale = "en" | "ur";

/** What a reader endpoint can answer with besides success. The panels map these to dictionary messages. */
export const READER_AI_ERRORS = [
  "not_configured", // no AI on this site: the buttons show "Coming soon"
  "not_found", // not published, wrong locale, or unknown article
  "unauthorized", // Ask needs a signed-in reader
  "forbidden", // cross-site request
  "invalid", // bad input
  "too_long", // question over QUESTION_MAX_CHARS
  "ask_limit", // this reader's daily question limit
  "busy", // per-minute limit
  "resting", // the site's daily AI cap
  "unavailable", // the provider failed or timed out
  "error",
] as const;
export type ReaderAiError = (typeof READER_AI_ERRORS)[number];

export const QUESTION_MAX_CHARS = 300;
/** Messages of earlier conversation sent with each question (the panel keeps them; nothing is stored). */
export const HISTORY_MAX_MESSAGES = 6;
const HISTORY_MAX_CHARS = 2000;

export type SummaryData = { bullets: string[]; questions: string[] };

export type SummaryResponse =
  | { status: "ready"; summary: SummaryData }
  | { status: "missing" } // GET only: not generated yet, POST to generate
  | { status: "generating" }; // another request is generating it: poll GET

/** Admin editor side panel: the state of each language's summary. "unavailable" = that language isn't complete. */
export type SummaryStatus = {
  state: "ready" | "stale" | "missing" | "unavailable";
  /** The cached summary (also shown when stale, as a preview of the old one). */
  summary: SummaryData | null;
  generatedAt: string | null;
};

/**
 * Admin editor side panel: generated "Listen" audio per language.
 * "unsupported" = server text-to-speech can't do this language (Urdu);
 * "unavailable" = the language isn't complete yet.
 */
export type AudioStatus = {
  state: "ready" | "stale" | "missing" | "unavailable" | "unsupported";
  /** Public URL of the current file (also when stale, for the admin's preview only). */
  url: string | null;
  durationMs: number | null;
  bytes: number | null;
  generatedAt: string | null;
};

export type ReaderAiStatus = {
  summaries: Record<ReaderLocale, SummaryStatus>;
  audio: Record<ReaderLocale, AudioStatus>;
  /** Audio needs Supabase Storage (features.storageEnabled). */
  storageEnabled: boolean;
};

/** GET /api/ai/listen: generated audio if current, else the text for the browser's own voice. */
export type ListenResponse =
  | { audio: { url: string; durationMs: number }; speech: null }
  | { audio: null; speech: { paragraphs: string[] } };

export const localeSchema = z.enum(["en", "ur"]);

export const summaryRequestSchema = z.object({ articleId: z.uuid(), locale: localeSchema });

export const askRequestSchema = z.object({
  articleId: z.uuid(),
  locale: localeSchema,
  question: z.string(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(HISTORY_MAX_CHARS) }))
    .max(HISTORY_MAX_MESSAGES)
    .default([]),
});
export type AskMessage = z.infer<typeof askRequestSchema>["history"][number];

/** Ask streams NDJSON events, like the admin endpoint. */
export type AskEvent =
  | { type: "delta"; text: string }
  /**
   * refused: the answer is the off-topic refusal; notCovered: "this article
   * doesn't cover that"; replace: show this text INSTEAD of what streamed
   * (the server's output guard stopped the answer).
   */
  | { type: "done"; refused?: boolean; notCovered?: boolean; replace?: string }
  | { type: "error"; error: ReaderAiError };

/** Normalises a question: collapses whitespace. Length is checked after this. */
export function cleanQuestion(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/** The text an article's AI features work from: title, then the body's plain text (no images or embeds). */
export function articleSourceText(title: string, body: ArticleDoc | null | undefined) {
  return `${title.trim()}\n\n${docToPlainText(body)}`.trim();
}

/** Model output shown to readers is plain text: no Markdown markers, no tags, single spaces. */
export function plainLine(value: string, max: number) {
  const text = value
    .replace(/<[^>]*>/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>`~]/g, "")
    .replace(/^\s*(?:[-•]|\d+[.)])\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
