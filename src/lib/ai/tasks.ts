import { z } from "zod";

import { LIMITS } from "@/lib/articles/rules";
import type { ArticleDoc } from "@/lib/content/document";

import type { AiErrorCode } from "./errors";
import { DRAFT_LENGTHS, DRAFT_TONES, EDIT_ACTIONS, type EditAction } from "./prompts";

/**
 * Wire protocol for POST /api/admin/ai, shared by the route (server) and
 * the editor (client). Pure module.
 *
 * Request: one JSON task object (validated with `aiTaskSchema`).
 * Response: NDJSON, one `AiEvent` per line, ending with a "result" or an
 * "error" event. Cancelling the fetch (Stop) aborts the model call.
 */

const locale = z.enum(["en", "ur"]);

export const aiTaskSchema = z.discriminatedUnion("task", [
  z.object({ task: z.literal("ping") }),
  z.object({
    task: z.literal("draft"),
    prompt: z.string().trim().min(3, "Describe the article you want").max(2000),
    notes: z.string().max(12_000).default(""),
    locale,
    length: z.enum(Object.keys(DRAFT_LENGTHS) as [keyof typeof DRAFT_LENGTHS, ...(keyof typeof DRAFT_LENGTHS)[]]),
    tone: z.enum(Object.keys(DRAFT_TONES) as [keyof typeof DRAFT_TONES, ...(keyof typeof DRAFT_TONES)[]]),
  }),
  z
    .object({
      task: z.literal("translate"),
      from: locale,
      to: locale,
      fields: z.object({
        title: z.string().max(LIMITS.title).default(""),
        excerpt: z.string().max(LIMITS.excerpt).default(""),
        seoTitle: z.string().max(LIMITS.seoTitle).default(""),
        seoDescription: z.string().max(LIMITS.seoDescription).default(""),
      }),
      /** Source body (Tiptap JSON); re-sanitized on the server. */
      body: z.unknown().nullable().default(null),
    })
    .refine((input) => input.from !== input.to, "Choose two different languages"),
  z.object({
    task: z.literal("suggest"),
    kind: z.enum(["headlines", "excerpt", "seoTitle", "seoDescription", "tags", "slug"]),
    locale,
    title: z.string().max(LIMITS.title).default(""),
    excerpt: z.string().max(LIMITS.excerpt).default(""),
    /** Body (Tiptap JSON) for context; only its plain text is sent to the model. */
    body: z.unknown().nullable().default(null),
  }),
  z.object({
    task: z.literal("edit"),
    action: z.enum(Object.keys(EDIT_ACTIONS) as [EditAction, ...EditAction[]]),
    locale,
    /** The selected content as a Tiptap doc; re-sanitized on the server. */
    selection: z.unknown(),
  }),
]);

export type SuggestKind = Extract<z.output<typeof aiTaskSchema>, { task: "suggest" }>["kind"];

export type TranslatableField = "title" | "excerpt" | "seoTitle" | "seoDescription";

export type AiTaskInput = z.input<typeof aiTaskSchema>;
export type AiTaskName = AiTaskInput["task"];
export type ParsedAiTask = z.output<typeof aiTaskSchema>;

/** Tag suggestions: matches to existing tags, plus new names (created only if the admin clicks them). */
export type TagSuggestions = {
  existing: { id: string; nameEn: string; nameUr: string | null }[];
  new: string[];
};

export type AiResults = {
  ping: { provider: "gemini" | "mock"; model: string; ms: number };
  draft: {
    doc: ArticleDoc;
    title: string;
    excerpt: string;
    tags: TagSuggestions;
    /** What the sanitizer removed from the model output. */
    removed: string[];
    warnings: string[];
  };
  translate: {
    /** Only fields whose source had text; others are absent (left untouched). */
    fields: Partial<Record<TranslatableField, string>>;
    /** Translated body, or null when the source body was empty (left untouched). */
    body: ArticleDoc | null;
    removed: string[];
    warnings: string[];
  };
  suggest: {
    kind: SuggestKind;
    /** Text options to click (5 headlines; 1 for the other text kinds; empty for tags). */
    options: string[];
    tags: TagSuggestions | null;
  };
  edit: {
    doc: ArticleDoc;
    removed: string[];
  };
};

export type AiEvent =
  | { type: "delta"; text: string }
  | { type: "progress"; done: number; total: number }
  | { type: "result"; data: unknown }
  | { type: "error"; code: AiErrorCode; message: string; retryAfter?: number };

export { locale as localeSchema };
