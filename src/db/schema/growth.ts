import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, localeEnum, updatedAt } from "./_shared";
import { articles } from "./content";

export const newsletterStatus = pgEnum("newsletter_status", [
  "PENDING",
  "ACTIVE",
  "UNSUBSCRIBED",
]);

export const AD_PLACEMENTS = [
  "home-top",
  "home-feed",
  "article-top",
  "article-inline",
  "article-bottom",
] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export const adPlacement = pgEnum("ad_placement", AD_PLACEMENTS);

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Store lower-cased; enforced in the subscribe action (Phase 7).
  email: text("email").notNull().unique(),
  locale: localeEnum("locale").default("en").notNull(),
  status: newsletterStatus("status").default("PENDING").notNull(),
  confirmToken: text("confirm_token").unique(),
  createdAt: createdAt(),
});

export const adSlots = pgTable("ad_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  placement: adPlacement("placement").notNull().unique(),
  htmlSnippet: text("html_snippet").default("").notNull(),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  updatedAt: updatedAt(),
});

/** Simple daily view counter: one row per article per day, incremented with an upsert. */
export const articleViews = pgTable(
  "article_views",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    count: integer("count").default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.articleId, table.date] })],
);
