import { date, integer, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { createdAt, localeEnum } from "./_shared";
import { articles } from "./content";

/**
 * Cached AI summaries: generated once per article + locale.
 * Regenerate when articles.updatedAt is newer than sourceUpdatedAt.
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
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [unique("ai_summaries_article_id_locale_unique").on(table.articleId, table.locale)],
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
