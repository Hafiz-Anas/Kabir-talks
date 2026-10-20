import "server-only";

import { z } from "zod";

import { generateJson, generateText, getAiProvider, streamText } from "@/lib/ai";
import { AiError } from "@/lib/ai/errors";
import { docToMarkdown, markdownToDoc, placeholder, placeholdersIn, splitMarkdown } from "@/lib/ai/markdown";
import { LANGUAGE_NAME, prompts } from "@/lib/ai/prompts";
import { isExpectedScript, WRONG_SCRIPT_MESSAGE } from "@/lib/ai/script";
import type { AiEvent, AiResults, ParsedAiTask, TranslatableField } from "@/lib/ai/tasks";
import { LIMITS } from "@/lib/articles/rules";
import { type ArticleDoc, sanitizeDoc } from "@/lib/content/document";

import { imagePrefix } from "../storage";
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

  async translate(input, ctx) {
    const { from, to } = input;
    const prefix = imagePrefix();
    const source = sanitizeDoc(input.body, { imagePrefix: prefix }).doc;
    const { markdown, blocks } = docToMarkdown(source);
    const chunks = markdown.trim() ? splitMarkdown(markdown) : [];
    const fieldEntries = Object.entries(input.fields).filter(([, value]) => value.trim()) as [TranslatableField, string][];
    if (!chunks.length && !fieldEntries.length) {
      throw new AiError("bad_request", `There's nothing in ${LANGUAGE_NAME[from]} to translate yet.`);
    }

    const total = chunks.length + (fieldEntries.length ? 1 : 0);
    let done = 0;
    ctx.emit({ type: "progress", done, total });
    const wrongScript = () => new AiError("invalid_output", WRONG_SCRIPT_MESSAGE[to]);

    // Title, excerpt and SEO fields together, as validated JSON with the same keys.
    const fields: Partial<Record<TranslatableField, string>> = {};
    if (fieldEntries.length) {
      const schema = z.object(Object.fromEntries(fieldEntries.map(([key]) => [key, z.string().max(2000)])));
      const { timeoutMs, ...request } = prompts.translateFields({ fields: Object.fromEntries(fieldEntries), from, to });
      const translated = (await generateJson(request, schema, call(ctx, timeoutMs))) as Record<string, string>;
      for (const [key] of fieldEntries) fields[key] = cleanLine(translated[key] ?? "", FIELD_LIMITS[key]);
      if (!isExpectedScript(Object.values(fields).join(" "), to)) throw wrongScript();
      ctx.emit({ type: "progress", done: ++done, total });
    }

    // Body, section by section, so long articles stay within output limits.
    const warnings: string[] = [];
    let missing = 0;
    const parts: string[] = [];
    for (const [index, chunk] of chunks.entries()) {
      const { timeoutMs, ...request } = prompts.translateChunk({ markdown: chunk, from, to, part: index + 1, parts: chunks.length });
      const result = await generateText(request, call(ctx, timeoutMs));
      if (result.truncated) throw new AiError("invalid_output", "The translation was cut off. Try translating a shorter article, or split it.");
      let translated = result.text;
      if (!isExpectedScript(translated, to)) throw wrongScript();
      // Every image/embed placeholder must come back: re-add lost ones at the end of their part.
      const returned = new Set(placeholdersIn(translated));
      for (const id of placeholdersIn(chunk)) {
        if (!returned.has(id)) {
          translated += `\n\n${placeholder(Number(id))}`;
          missing++;
        }
      }
      parts.push(translated);
      ctx.emit({ type: "progress", done: ++done, total });
    }
    if (missing) {
      warnings.push(
        missing === 1
          ? "1 image or embed was moved to the end of its section. Check the placement."
          : `${missing} images or embeds were moved to the end of their sections. Check the placement.`,
      );
    }

    let body: ArticleDoc | null = null;
    let removed: string[] = [];
    if (parts.length) {
      const converted = markdownToDoc(parts.join("\n\n"), { source: "ai", blocks, imagePrefix: prefix });
      if (!converted.doc) throw new AiError("invalid_output");
      body = converted.doc;
      removed = converted.removed;
    }
    return { fields, body, removed, warnings };
  },
};

const FIELD_LIMITS: Record<TranslatableField, number> = {
  title: LIMITS.title,
  excerpt: LIMITS.excerpt,
  seoTitle: LIMITS.seoTitle,
  seoDescription: LIMITS.seoDescription,
};
