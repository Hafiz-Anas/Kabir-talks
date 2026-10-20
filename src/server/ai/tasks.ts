import "server-only";

import { generateText, getAiProvider } from "@/lib/ai";
import { prompts } from "@/lib/ai/prompts";
import type { AiEvent, AiResults, ParsedAiTask } from "@/lib/ai/tasks";

/**
 * AI task handlers behind POST /api/admin/ai. The route has already called
 * requireAdmin() and validated the input; handlers call the model through
 * src/lib/ai (timeouts, limits, errors) and must validate everything the
 * model returns before it goes back to the editor.
 */

export type TaskContext = {
  userId: string;
  signal: AbortSignal;
  emit: (event: AiEvent) => void;
};

type Handlers = {
  [K in ParsedAiTask["task"]]: (input: Extract<ParsedAiTask, { task: K }>, ctx: TaskContext) => Promise<AiResults[K]>;
};

export const handlers: Handlers = {
  async ping(_input, ctx) {
    const startedAt = Date.now();
    const { timeoutMs, ...request } = prompts.ping();
    await generateText(request, { userId: ctx.userId, signal: ctx.signal, timeoutMs });
    const ai = getAiProvider()!;
    return { provider: ai.name, model: ai.model, ms: Date.now() - startedAt };
  },
};
