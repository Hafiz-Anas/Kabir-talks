import "server-only";

import { z } from "zod";

import { generateJson, generateText, getAiProvider, streamText } from "@/lib/ai";
import { AiError } from "@/lib/ai/errors";
import { markdownToDoc } from "@/lib/ai/markdown";
import { prompts } from "@/lib/ai/prompts";
import { isExpectedScript, WRONG_SCRIPT_MESSAGE } from "@/lib/ai/script";
import type { AiEvent, AiResults, ParsedAiTask } from "@/lib/ai/tasks";
import { LIMITS } from "@/lib/articles/rules";

import { matchTags } from "./tags";

/**
 * AI task handlers behind POST /api/admin/ai. The route has already called
 * requireAdmin() and validated the input; handlers call the model through
 * src/lib/ai (timeouts, limits, errors) and validate everything the model
 * returns before it goes back to the editor. Model output is untrusted, like
 * pasted content: bodies always pass through markdownToDoc → sanitizeDoc.
 */

export type TaskContext = {
  userId: string;
  signal: AbortSignal;
  emit: (event: AiEvent) => void;
};

type Handlers = {
  [K in ParsedAiTask["task"]]: (input: Extract<ParsedAiTask, { task: K }>, ctx: TaskContext) => Promise<AiResults[K]>;
};

const call = (ctx: TaskContext, timeoutMs: number) => ({ userId: ctx.userId, signal: ctx.signal, timeoutMs });

/** Plain single-line text from the model: no Markdown, no tags, trimmed to a limit. */
function cleanLine(value: string, max: number) {
  const text = value.replace(/<[^>]*>/g, "").replace(/[*_#>`]/g, "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const draftMetaSchema = z.object({
  title: z.string().max(400),
  excerpt: z.string().max(1000),
  tags: z.array(z.string().max(80)).max(10),
});

export const handlers: Handlers = {
  async ping(_input, ctx) {
    const startedAt = Date.now();
    const { timeoutMs, ...request } = prompts.ping();
    await generateText(request, call(ctx, timeoutMs));
    const ai = getAiProvider()!;
    return { provider: ai.name, model: ai.model, ms: Date.now() - startedAt };
  },

  async draft(input, ctx) {
    const { timeoutMs, ...request } = prompts.draftBody(input);
    let markdown = "";
    for await (const delta of streamText(request, call(ctx, timeoutMs))) {
      markdown += delta;
      ctx.emit({ type: "delta", text: delta });
    }

    if (!isExpectedScript(markdown, input.locale)) throw new AiError("invalid_output", WRONG_SCRIPT_MESSAGE[input.locale]);
    // imagePrefix null: the model can never add images (or embeds) to an article.
    const converted = markdownToDoc(markdown, { source: "ai", imagePrefix: null });
    if (!converted.doc) throw new AiError("invalid_output", "The AI didn't return any usable article text. Please try again.");

    // Title, excerpt and tags. If this part fails, the draft is still usable.
    const warnings: string[] = [];
    let meta: z.infer<typeof draftMetaSchema> = { title: "", excerpt: "", tags: [] };
    try {
      const { timeoutMs: metaTimeout, ...metaRequest } = prompts.draftMeta({ prompt: input.prompt, markdown, locale: input.locale });
      meta = await generateJson(metaRequest, draftMetaSchema, call(ctx, metaTimeout));
    } catch (error) {
      if (error instanceof AiError && error.code === "aborted") throw error;
      warnings.push("The title, excerpt and tag suggestions couldn't be generated this time.");
    }

    const title = cleanLine(meta.title, LIMITS.title);
    const excerpt = cleanLine(meta.excerpt, LIMITS.excerpt);
    return {
      doc: converted.doc,
      title: isExpectedScript(title, input.locale) ? title : "",
      excerpt: isExpectedScript(excerpt, input.locale) ? excerpt : "",
      tags: await matchTags(meta.tags),
      removed: converted.removed,
      warnings,
    };
  },
};
