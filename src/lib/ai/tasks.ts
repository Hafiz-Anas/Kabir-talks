import { z } from "zod";

import type { ArticleDoc } from "@/lib/content/document";

import type { AiErrorCode } from "./errors";
import { DRAFT_LENGTHS, DRAFT_TONES } from "./prompts";

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
]);

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
};

export type AiEvent =
  | { type: "delta"; text: string }
  | { type: "progress"; done: number; total: number }
  | { type: "result"; data: unknown }
  | { type: "error"; code: AiErrorCode; message: string; retryAfter?: number };

export { locale as localeSchema };
