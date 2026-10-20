import { z } from "zod";

import type { AiErrorCode } from "./errors";

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
]);

export type AiTaskInput = z.input<typeof aiTaskSchema>;
export type AiTaskName = AiTaskInput["task"];
export type ParsedAiTask = z.output<typeof aiTaskSchema>;

export type AiResults = {
  ping: { provider: "gemini" | "mock"; model: string; ms: number };
};

export type AiEvent =
  | { type: "delta"; text: string }
  | { type: "progress"; done: number; total: number }
  | { type: "result"; data: unknown }
  | { type: "error"; code: AiErrorCode; message: string; retryAfter?: number };

export { locale as localeSchema };
