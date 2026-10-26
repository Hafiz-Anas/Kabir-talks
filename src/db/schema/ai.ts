import { date, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { createdAt, localeEnum } from "./_shared";
import { articles } from "./content";

/**
 * Cached AI summaries: generated once per article + locale.
 * Regenerate when articles.updatedAt is newer than sourceUpdatedAt AND the
 * text changed (sourceHash), so edits to tags or SEO fields cost nothing.
 * Phase 6: `summary` holds the 3-5 bullet points, one per line, as plain
 * text; `questions` holds 3 suggested starter questions for "Ask".
 */
export const aiSummaries = pgTable(
  "ai_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    summary: text("summary").notNull(),
    questions: jsonb("questions").$type<string[]>().default([]).notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }).notNull(),
    // SHA-256 of the title + plain text the summary was made from.
    sourceHash: text("source_hash").default("").notNull(),
    createdAt: createdAt(),
  },
  (table) => [unique("ai_summaries_article_id_locale_unique").on(table.articleId, table.locale)],
);

/**
 * Phase 6: short leases so one slow AI job (a summary, an audio file) runs
 * once even when many readers or several server instances ask at the same
 * moment. Keys: "summary:{articleId}:{locale}", "audio:{articleId}:{locale}".
 * A lease older than its timeout is taken over (crashed instance).
 */
export const aiJobs = pgTable("ai_jobs", {
  key: text("key").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Phase 6: generated "Listen" audio, one file per article + locale, made
 * only when the admin clicks "Generate audio". The file lives in Storage
 * (bucket article-audio, `path`); a new text (sourceHash) makes it out of
 * date, and out-of-date audio is never played to readers.
 */
export const aiAudio = pgTable(
  "ai_audio",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    // Object path in the article-audio bucket: audio/{articleId}/{locale}-{hash}.wav
    path: text("path").notNull(),
    bytes: integer("bytes").notNull(),
    durationMs: integer("duration_ms").notNull(),
    voice: text("voice").notNull(),
    sourceHash: text("source_hash").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [unique("ai_audio_article_id_locale_unique").on(table.articleId, table.locale)],
);

/** Every billable feature. "admin" covers all editor AI (Phase 3). */
export const AI_FEATURES = ["admin", "summary", "ask", "listen"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/**
 * Phase 6: model calls per day and feature, for the global daily cap
 * (AI_DAILY_LIMIT) and the admin dashboard. `day` is the Pakistan date
 * (src/server/ai/limits.ts). Counts only: never prompts, questions or answers.
 */
export const aiUsage = pgTable(
  "ai_usage",
  {
    day: date("day").notNull(),
    feature: text("feature").$type<AiFeature>().notNull(),
    count: integer("count").default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.day, table.feature] })],
);
