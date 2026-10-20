import "server-only";

import { revalidatePath, updateTag } from "next/cache";

import { locales } from "@/i18n/config";
import { cacheTags } from "@/lib/cache-tags";
import { articlePath, categoryPath } from "@/lib/urls";

/**
 * Invalidation after admin mutations. Call ONLY from Server Actions
 * (updateTag is restricted to them). Tags expire the "use cache" reads in
 * src/server/public/*; paths cover any page that renders without them.
 */

type ArticleLocation = { categorySlug: string; slug: string };

export function revalidateArticle(
  id: string,
  current: ArticleLocation,
  previous?: ArticleLocation | null,
) {
  updateTag(cacheTags.articles);
  updateTag(cacheTags.article(id));

  const locations = [current];
  if (previous && (previous.slug !== current.slug || previous.categorySlug !== current.categorySlug)) {
    locations.push(previous);
  }

  for (const location of locations) {
    updateTag(cacheTags.category(location.categorySlug));
    for (const locale of locales) {
      revalidatePath(categoryPath(locale, location.categorySlug));
      revalidatePath(articlePath(locale, location.categorySlug, location.slug));
    }
  }
  for (const locale of locales) revalidatePath(`/${locale}`);
}

/** Category changes can move many article URLs, so refresh the whole public site. */
export function revalidateCategories(slugs: string[]) {
  updateTag(cacheTags.categories);
  updateTag(cacheTags.articles);
  for (const slug of new Set(slugs)) updateTag(cacheTags.category(slug));
  revalidatePath("/[locale]", "layout");
}
