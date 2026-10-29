import "./load-env";

import { sql } from "drizzle-orm";

import { db, pgClient } from "./index";
import { LEGAL_TEMPLATES } from "./legal-templates";
import { AD_PLACEMENTS, adSlots, authors, categories, SITE_PAGE_SLUGS, sitePages } from "./schema";

/**
 * Idempotent base seed: safe to run more than once.
 * - Categories are upserted by slug (names are refreshed).
 * - Ad slots are inserted only if missing, so admin edits are never overwritten.
 * - Privacy Policy and Terms of Use templates (Phase 7): inserted only if missing.
 * - Main author "Kabir" (Phase 7C): inserted only when there is no main author
 *   (migration 0017 normally creates him), so the owner's edits are kept.
 */
const MAIN_AUTHOR = {
  slug: "kabir",
  nameEn: "Kabir",
  nameUr: "کبیر",
  titleEn: "Founder & Editor",
  titleUr: "بانی و مدیر",
  bioEn: "Founder of Kabir Talks.",
  bioUr: "کبیر ٹاکس کے بانی۔",
};

async function main() {
  const seededCategories = await db
    .insert(categories)
    .values([
      { slug: "current-affairs", nameEn: "Current Affairs", nameUr: "حالات حاضرہ", sortOrder: 1 },
      { slug: "sports", nameEn: "Sports", nameUr: "کھیل", sortOrder: 2 },
    ])
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        nameEn: sql`excluded.name_en`,
        nameUr: sql`excluded.name_ur`,
        sortOrder: sql`excluded.sort_order`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ slug: categories.slug });

  const insertedSlots = await db
    .insert(adSlots)
    .values(AD_PLACEMENTS.map((placement) => ({ placement, isEnabled: false })))
    .onConflictDoNothing({ target: adSlots.placement })
    .returning({ placement: adSlots.placement });

  const insertedPages = await db
    .insert(sitePages)
    .values(SITE_PAGE_SLUGS.map((slug) => ({ slug, ...LEGAL_TEMPLATES[slug], isTemplate: true })))
    .onConflictDoNothing({ target: sitePages.slug })
    .returning({ slug: sitePages.slug });

  const hasMainAuthor = await db.query.authors.findFirst({ where: (a, { eq }) => eq(a.isDefault, true), columns: { id: true } });
  const insertedAuthor = hasMainAuthor
    ? []
    : await db
        .insert(authors)
        .values({ ...MAIN_AUTHOR, isDefault: true })
        .onConflictDoUpdate({ target: authors.slug, set: { isDefault: true } })
        .returning({ slug: authors.slug });

  console.log(`✔ Main author: ${insertedAuthor.length ? "created (kabir)" : "already there"}`);
  console.log(`✔ Categories upserted: ${seededCategories.map((c) => c.slug).join(", ")}`);
  console.log(`✔ Legal page templates inserted: ${insertedPages.map((p) => p.slug).join(", ") || "none (already there)"}`);
  console.log(
    `✔ Ad slots inserted: ${insertedSlots.length} new (of ${AD_PLACEMENTS.length}; existing rows left untouched)`,
  );
}

main()
  .catch((error) => {
    console.error("✖ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
