import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

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
