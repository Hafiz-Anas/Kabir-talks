import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, localeEnum, updatedAt } from "./_shared";
import { user } from "./auth";
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

/** Which stories a subscriber wants: English, Urdu, or both. */
export const NEWSLETTER_LANGUAGES = ["en", "ur", "both"] as const;
export const newsletterLanguage = pgEnum("newsletter_language", NEWSLETTER_LANGUAGES);

/**
 * Phase 7 newsletter. Double opt-in: PENDING until the emailed link is
 * opened, and only ACTIVE subscribers receive mail. Only the email, the
 * languages and timestamps are stored. Link tokens are never stored: the
 * columns hold an HMAC of them (src/server/newsletter/tokens.ts).
 */
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Lower-cased by the subscribe handler.
  email: text("email").notNull().unique(),
  /** Language of the emails' wording (the page they signed up on). */
  locale: localeEnum("locale").default("en").notNull(),
  /** Which stories they get. */
  language: newsletterLanguage("language").default("en").notNull(),
  status: newsletterStatus("status").default("PENDING").notNull(),
  confirmTokenHash: text("confirm_token_hash").unique(),
  confirmExpiresAt: timestamp("confirm_expires_at", { withTimezone: true }),
  unsubscribeTokenHash: text("unsubscribe_token_hash").unique(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const newsletterSendKind = pgEnum("newsletter_send_kind", ["article", "digest"]);
export const newsletterSendStatus = pgEnum("newsletter_send_status", ["queued", "done"]);
export const newsletterDeliveryStatus = pgEnum("newsletter_delivery_status", [
  "pending",
  "sending",
  "sent",
  "failed",
  "skipped",
]);

/** One localized block of a newsletter: the stories in one language. */
export type NewsletterGroup = {
  subject: string;
  heading: string;
  intro: string;
  items: { title: string; url: string; excerpt: string | null; meta: string | null }[];
};
export type NewsletterPayload = Partial<Record<"en" | "ur", NewsletterGroup>>;

/**
 * A queued newsletter: one article, or one weekly digest. `dedupeKey` is
 * unique ("article:{id}", "digest:{week}"), so the same thing can never be
 * queued twice. The content is frozen in `payload` when it is queued, so
 * every subscriber gets the same email even if the article is edited later.
 */
export const newsletterSends = pgTable("newsletter_sends", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: newsletterSendKind("kind").notNull(),
  dedupeKey: text("dedupe_key").notNull().unique(),
  articleId: uuid("article_id").references(() => articles.id, { onDelete: "set null" }),
  payload: jsonb("payload").$type<NewsletterPayload>().notNull(),
  status: newsletterSendStatus("status").default("queued").notNull(),
  recipients: integer("recipients").default(0).notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/**
 * One row per (send, subscriber), created when the send is queued. The
 * processor (npm run newsletter:process, or the cron endpoint) claims
 * pending rows in small batches; a claimed row that is never finished is
 * retried after a timeout. Primary key = one email per subscriber per send.
 */
export const newsletterDeliveries = pgTable(
  "newsletter_deliveries",
  {
    sendId: uuid("send_id")
      .notNull()
      .references(() => newsletterSends.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => newsletterSubscribers.id, { onDelete: "cascade" }),
    status: newsletterDeliveryStatus("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
  },
  (table) => [
    primaryKey({ columns: [table.sendId, table.subscriberId] }),
    index("newsletter_deliveries_status_idx").on(table.status),
  ],
);

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
