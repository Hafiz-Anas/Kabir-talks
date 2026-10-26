import "server-only";

import { z } from "zod";

import { type CallOptions, generateJson, generateText, getAiProvider, streamText } from "@/lib/ai";
import { AiError } from "@/lib/ai/errors";
import { docToMarkdown, markdownToDoc, placeholder, placeholdersIn, splitMarkdown } from "@/lib/ai/markdown";
import { LANGUAGE_NAME, prompts } from "@/lib/ai/prompts";
import { isExpectedScript, WRONG_SCRIPT_MESSAGE } from "@/lib/ai/script";
import type { AiEvent, AiResults, ParsedAiTask, TranslatableField } from "@/lib/ai/tasks";
import { LIMITS, SEO_RECOMMENDED } from "@/lib/articles/rules";
import { isValidSlug, slugify } from "@/lib/articles/slug";
import { type ArticleDoc, docToPlainText, sanitizeDoc } from "@/lib/content/document";

import { imagePrefix } from "../storage";
import { getReaderAiStatus } from "./status";
import { generateSummary, loadArticleSource } from "./summaries";
import { existingTagNames, matchTags } from "./tags";

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

const call = (ctx: TaskContext, timeoutMs: number): CallOptions => ({
  rateKey: `admin:${ctx.userId}`,
  feature: "admin",
  signal: ctx.signal,
  timeoutMs,
});

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

  async suggest(input, ctx) {
    const text = docToPlainText(sanitizeDoc(input.body, { imagePrefix: null }).doc).slice(0, 8000);
    const context = { locale: input.locale, title: input.title.trim(), excerpt: input.excerpt.trim(), text };

    if (input.kind === "slug") {
      if (!context.title) throw new AiError("bad_request", "Add an English title first: the slug is based on it.");
      const { timeoutMs, ...request } = prompts.suggestSlug({ title: context.title });
      const { slug } = await generateJson(request, z.object({ slug: z.string().max(200) }), call(ctx, timeoutMs));
      const clean = slugify(slug, 80);
      const fallback = slugify(context.title, 80);
      return { kind: input.kind, options: [isValidSlug(clean) ? clean : fallback].filter(Boolean), tags: null };
    }

    if (!context.title && !context.text) throw new AiError("bad_request", "Add a title or some body text first.");

    if (input.kind === "tags") {
      const existing = await existingTagNames();
      const { timeoutMs, ...request } = prompts.suggestTags({ ...context, existing });
      const { tags } = await generateJson(request, z.object({ tags: z.array(z.string().max(80)).max(12) }), call(ctx, timeoutMs));
      return { kind: input.kind, options: [], tags: await matchTags(tags) };
    }

    const spec = {
      headlines: { build: prompts.suggestHeadlines, key: "headlines", max: LIMITS.title },
      excerpt: { build: prompts.suggestExcerpt, key: "excerpt", max: SEO_RECOMMENDED.description },
      seoTitle: { build: prompts.suggestSeoTitle, key: "seoTitle", max: SEO_RECOMMENDED.title },
      seoDescription: { build: prompts.suggestSeoDescription, key: "seoDescription", max: SEO_RECOMMENDED.description },
    }[input.kind];
    const { timeoutMs, ...request } = spec.build(context);
    const schema = z.object({ [spec.key]: spec.key === "headlines" ? z.array(z.string().max(400)).min(1).max(10) : z.string().max(1000) });
    const raw = (await generateJson(request, schema, call(ctx, timeoutMs)))[spec.key] as string | string[];

    const options = [...new Set((Array.isArray(raw) ? raw : [raw]).map((value) => cleanLine(value, spec.max)))]
      .filter((value) => value && isExpectedScript(value, input.locale))
      .slice(0, 5);
    if (!options.length) throw new AiError("invalid_output", WRONG_SCRIPT_MESSAGE[input.locale]);
    return { kind: input.kind, options, tags: null };
  },

  async edit(input, ctx) {
    const prefix = imagePrefix();
    const selection = sanitizeDoc(input.selection, { imagePrefix: prefix }).doc;
    const { markdown, blocks } = docToMarkdown(selection);
    if (!markdown.trim()) throw new AiError("bad_request", "Select some text first.");
    if (markdown.length > 12_000) throw new AiError("bad_request", "That selection is too long. Select a few paragraphs at a time.");

    const { timeoutMs, ...request } = prompts.edit({ markdown, action: input.action, locale: input.locale });
    let output = "";
    for await (const delta of streamText(request, call(ctx, timeoutMs))) {
      output += delta;
      ctx.emit({ type: "delta", text: delta });
    }
    // The rewrite must stay in the selection's language.
    if (!isExpectedScript(output, input.locale)) throw new AiError("invalid_output", WRONG_SCRIPT_MESSAGE[input.locale]);
    const converted = markdownToDoc(output, { source: "ai", blocks, imagePrefix: prefix });
    if (!converted.doc) throw new AiError("invalid_output");
    return { doc: converted.doc, removed: converted.removed };
  },

  async "reader-ai-status"(input) {
    return getReaderAiStatus(input.articleId);
  },

  /** Regenerates one language's summary from the SAVED article (any status), even if it is current. */
  async summary(input, ctx) {
    const source = await loadArticleSource(input.articleId, input.locale, { publishedOnly: false });
    if (!source) {
      throw new AiError("bad_request", `Add a ${LANGUAGE_NAME[input.locale]} title and body, and save, before generating its summary.`);
    }
    await generateSummary(source, { rateKey: `admin:${ctx.userId}`, force: true, waitMs: 60_000 });
    return getReaderAiStatus(input.articleId);
  },
};

const FIELD_LIMITS: Record<TranslatableField, number> = {
  title: LIMITS.title,
  excerpt: LIMITS.excerpt,
  seoTitle: LIMITS.seoTitle,
  seoDescription: LIMITS.seoDescription,
};
