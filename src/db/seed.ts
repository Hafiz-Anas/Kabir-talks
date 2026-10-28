import "./load-env";

import { sql } from "drizzle-orm";

import { db, pgClient } from "./index";
import { LEGAL_TEMPLATES } from "./legal-templates";
import { AD_PLACEMENTS, adSlots, categories, SITE_PAGE_SLUGS, sitePages } from "./schema";

/**
 * Idempotent base seed: safe to run more than once.
 * - Categories are upserted by slug (names are refreshed).
 * - Ad slots are inserted only if missing, so admin edits are never overwritten.
 * - Privacy Policy and Terms of Use templates (Phase 7): inserted only if missing.
 */
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
