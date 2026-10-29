import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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

/**
 * Phase 7: one AdSense unit per placement. Only IDs are stored, never ad
 * code: the admin may paste a whole ad unit, and src/lib/ads.ts extracts the
 * slot ID and format from it. The site renders the <ins> tag itself.
 */
export const adSlots = pgTable("ad_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  placement: adPlacement("placement").notNull().unique(),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  /** data-ad-slot: digits only. */
  slotId: text("slot_id"),
  /** data-ad-format: auto | fluid | rectangle | horizontal | vertical. */
  adFormat: text("ad_format").default("auto").notNull(),
  /** data-ad-layout ("in-article") and data-ad-layout-key (in-feed units), when the unit has them. */
  adLayout: text("ad_layout"),
  adLayoutKey: text("ad_layout_key"),
  updatedAt: updatedAt(),
});

/**
 * Phase 7: small site-wide settings edited in the admin, as JSON per key:
 * "ads" (AdSense publisher ID and switches), "contact" (public email).
 * Typed accessors: src/server/settings.ts.
 */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
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
  (table) => [primaryKey({ columns: [table.articleId, table.date] }), index("article_views_date_idx").on(table.date)],
);

/**
 * Phase 7: who already counted for an article today, so each visitor counts
 * once per article per day. `visitorHash` is an HMAC of IP + user agent with
 * a key that changes every day (src/server/views.ts): it can't be turned back
 * into an IP, nor linked across days. Rows older than two days are deleted.
 */
export const articleViewVisitors = pgTable(
  "article_view_visitors",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    visitorHash: text("visitor_hash").notNull(),
  },
  (table) => [primaryKey({ columns: [table.articleId, table.date, table.visitorHash] }), index("article_view_visitors_date_idx").on(table.date)],
);

/** Legal pages the admin edits with the article editor (Phase 7). */
export const SITE_PAGE_SLUGS = ["privacy", "terms"] as const;
export type SitePageSlug = (typeof SITE_PAGE_SLUGS)[number];
export const sitePageSlug = pgEnum("site_page_slug", SITE_PAGE_SLUGS);

/**
 * Privacy Policy and Terms of Use, in both languages. Bodies are Tiptap
 * JSON, sanitized on save and rendered with the shared renderer (never raw
 * HTML). `isTemplate` stays true until the admin saves the page once, so the
 * seeded starter text is flagged for review.
 */
export const sitePages = pgTable("site_pages", {
  slug: sitePageSlug("slug").primaryKey(),
  titleEn: text("title_en").notNull(),
  titleUr: text("title_ur").notNull(),
  bodyEn: jsonb("body_en"),
  bodyUr: jsonb("body_ur"),
  isTemplate: boolean("is_template").default(true).notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/** Contact form messages (Phase 7). Plain text only; never rendered as HTML. */
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    locale: localeEnum("locale").default("en").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("contact_messages_created_at_idx").on(table.createdAt)],
);

/**
 * Phase 7C: items for the "Breaking" bar under the header. Either language's
 * text may be empty (the bar is then hidden in that language). The link is an
 * article (shown only while it is published) or an https URL, never both.
 * Several items can be live; the public endpoint shows the newest first and
 * drops expired ones (src/server/breaking.ts).
 */
export const breakingNews = pgTable(
  "breaking_news",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    textEn: text("text_en"),
    textUr: text("text_ur"),
    articleId: uuid("article_id").references(() => articles.id, { onDelete: "set null" }),
    linkUrl: text("link_url"),
    isActive: boolean("is_active").default(true).notNull(),
    /** Null = stays until switched off. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("breaking_news_active_created_idx").on(table.isActive, table.createdAt.desc()),
    check("breaking_news_has_text", sql`coalesce(btrim(${table.textEn}), '') <> '' OR coalesce(btrim(${table.textUr}), '') <> ''`),
    check("breaking_news_one_link", sql`${table.articleId} IS NULL OR ${table.linkUrl} IS NULL`),
  ],
);
