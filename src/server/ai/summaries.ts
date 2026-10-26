import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { aiSummaries, articles } from "@/db/schema";
import { locales, type Locale } from "@/i18n/config";
import { type CallOptions, generateJson, getAiProvider } from "@/lib/ai";
import { AiError } from "@/lib/ai/errors";
import { readerPrompts } from "@/lib/ai/prompts";
import { articleSourceText, plainLine, type SummaryData, type SummaryStatus } from "@/lib/ai/reader";
import { isExpectedScript, WRONG_SCRIPT_MESSAGE } from "@/lib/ai/script";
import { isLocaleComplete } from "@/lib/articles/rules";
import type { ArticleDoc } from "@/lib/content/document";

import { acquireLease, releaseLease, singleFlight, sleep } from "./jobs";
import { sourceHash } from "./source-hash";

/**
 * Article summaries (Phase 6): 3-5 bullet points plus 3 starter questions
 * for "Ask this article", per article + locale, cached in ai_summaries.
 *
 *  - Publishing or updating a live article refreshes them in the background
 *    (after the response, see src/server/article-actions.ts).
 *  - A reader who finds none triggers ONE generation: concurrent clicks in
 *    one instance share a promise, other instances wait on the ai_jobs lease.
 *  - A summary is current while the article's text is unchanged (sourceHash);
 *    edits to other fields only move sourceUpdatedAt forward.
 */

export type ArticleSource = {
  id: string;
  locale: Locale;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  title: string;
  body: ArticleDoc | null;
  updatedAt: Date;
  /** Title + plain body text: what every reader AI feature works from. */
  text: string;
  hash: string;
};

/**
 * The article in one locale, or null if it doesn't exist or that locale
 * isn't complete. Reader endpoints pass publishedOnly, so drafts and
 * archived articles are "not found" everywhere.
 */
export async function loadArticleSource(articleId: string, locale: Locale, options: { publishedOnly: boolean }) {
  const [row] = await db
    .select({
      id: articles.id,
      status: articles.status,
      titleEn: articles.titleEn,
      titleUr: articles.titleUr,
      bodyEn: articles.bodyEn,
      bodyUr: articles.bodyUr,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!row || (options.publishedOnly && row.status !== "PUBLISHED")) return null;
  const title = (locale === "en" ? row.titleEn : row.titleUr)?.trim() ?? "";
  const body = (locale === "en" ? row.bodyEn : row.bodyUr) as ArticleDoc | null;
  if (!title || !isLocaleComplete({ title, body })) return null;
  const text = articleSourceText(title, body);
  return { id: row.id, locale, status: row.status, title, body, updatedAt: row.updatedAt, text, hash: sourceHash(text) } satisfies ArticleSource;
}

type SummaryRow = typeof aiSummaries.$inferSelect;

const toSummary = (row: SummaryRow): SummaryData => ({
  bullets: row.summary.split("\n").filter(Boolean),
  questions: row.questions,
});

async function findRow(articleId: string, locale: Locale) {
  const [row] = await db
    .select()
    .from(aiSummaries)
    .where(and(eq(aiSummaries.articleId, articleId), eq(aiSummaries.locale, locale)))
    .limit(1);
  return row ?? null;
}

/** The cached summary if it still matches the article's text, else null. */
export async function getFreshSummary(source: ArticleSource): Promise<SummaryData | null> {
  const row = await findRow(source.id, source.locale);
  if (!row || row.sourceHash !== source.hash) return null;
  if (row.sourceUpdatedAt < source.updatedAt) {
    // Edited, but not the text (tags, SEO, status…): the summary still fits.
    await db.update(aiSummaries).set({ sourceUpdatedAt: source.updatedAt }).where(eq(aiSummaries.id, row.id));
  }
  return toSummary(row);
}

const summarySchema = z.object({
  bullets: z.array(z.string().max(1000)).min(3).max(8),
  questions: z.array(z.string().max(500)).max(6),
});

type GenerateOptions = Pick<CallOptions, "rateKey" | "perMinute">;

async function callModel(source: ArticleSource, options: GenerateOptions): Promise<SummaryData> {
  const { timeoutMs, ...request } = readerPrompts.summary({ locale: source.locale, text: source.text });
  const raw = await generateJson(request, summarySchema, { ...options, feature: "summary", timeoutMs });
  // Untrusted output: plain text only, trimmed to sensible lengths.
  const bullets = raw.bullets.map((b) => plainLine(b, 320)).filter(Boolean).slice(0, 5);
  const questions = raw.questions.map((q) => plainLine(q, 150)).filter(Boolean).slice(0, 3);
  if (bullets.length < 3) throw new AiError("invalid_output");
  if (!isExpectedScript([...bullets, ...questions].join("\n"), source.locale)) {
    throw new AiError("invalid_output", WRONG_SCRIPT_MESSAGE[source.locale]);
  }
  return { bullets, questions };
}

async function save(source: ArticleSource, data: SummaryData) {
  const values = {
    summary: data.bullets.join("\n"),
    questions: data.questions,
    sourceHash: source.hash,
    sourceUpdatedAt: source.updatedAt,
    createdAt: new Date(),
  };
  await db
    .insert(aiSummaries)
    .values({ articleId: source.id, locale: source.locale, ...values })
    .onConflictDoUpdate({ target: [aiSummaries.articleId, aiSummaries.locale], set: values });
}

/** A summary job that outlives this is treated as crashed (the model call times out at 45 s). */
const LEASE_SECONDS = 90;
const flight = singleFlight<SummaryData | null>();

/**
 * Returns the summary, generating it at most once. `force` regenerates even
 * a current one (admin). If another instance is still generating after
 * `waitMs`, returns null (the reader's panel polls). Throws AiError.
 */
export function generateSummary(
  source: ArticleSource,
  options: GenerateOptions & { force?: boolean; waitMs?: number },
): Promise<SummaryData | null> {
  const key = `summary:${source.id}:${source.locale}`;
  return flight(`${key}:${source.hash}:${options.force ? "force" : ""}`, async () => {
    if (!options.force) {
      const fresh = await getFreshSummary(source);
      if (fresh) return fresh;
    }
    const deadline = Date.now() + (options.waitMs ?? 40_000);
    while (!(await acquireLease(key, LEASE_SECONDS))) {
      // Another instance is generating it: wait for its result rather than paying twice.
      if (Date.now() >= deadline) return null;
      await sleep(750);
      if (!options.force) {
        const fresh = await getFreshSummary(source);
        if (fresh) return fresh;
      }
    }
    try {
      if (!options.force) {
        const fresh = await getFreshSummary(source);
        if (fresh) return fresh;
      }
      const data = await callModel(source, options);
      await save(source, data);
      return data;
    } finally {
      await releaseLease(key);
    }
  });
}

/**
 * After publishing or saving a live article: make sure every available
 * language has a current summary. Runs after the response (next/server
 * `after`); failures are logged by code only and never touch the article.
 */
export async function refreshSummaries(articleId: string) {
  if (!getAiProvider()) return;
  for (const locale of locales) {
    try {
      const source = await loadArticleSource(articleId, locale, { publishedOnly: true });
      if (source) await generateSummary(source, { rateKey: null, waitMs: 0 });
    } catch (error) {
      console.warn(`[ai] background summary ${locale} failed: ${error instanceof AiError ? error.code : "error"}`);
    }
  }
}

/** Admin editor: summary state per language. "unavailable" = that language isn't complete yet. */
export async function getSummaryStatuses(articleId: string): Promise<Record<Locale, SummaryStatus>> {
  const entries = await Promise.all(
    locales.map(async (locale): Promise<[Locale, SummaryStatus]> => {
      const [source, row] = await Promise.all([loadArticleSource(articleId, locale, { publishedOnly: false }), findRow(articleId, locale)]);
      const summary = row ? toSummary(row) : null;
      const generatedAt = row?.createdAt.toISOString() ?? null;
      if (!source) return [locale, { state: "unavailable", summary, generatedAt }];
      if (!row) return [locale, { state: "missing", summary: null, generatedAt: null }];
      return [locale, { state: row.sourceHash === source.hash ? "ready" : "stale", summary, generatedAt }];
    }),
  );
  return Object.fromEntries(entries) as Record<Locale, SummaryStatus>;
}
