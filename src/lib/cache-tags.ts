/**
 * Cache tags shared by public "use cache" reads (src/server/public/*) and the
 * admin mutations that invalidate them (src/server/revalidate.ts).
 */
export const cacheTags = {
  /** Any list of published articles (homepage, feeds). */
  articles: "articles",
  article: (id: string) => `article:${id}`,
  categories: "categories",
  category: (slug: string) => `category:${slug}`,
  /** Admin-edited site settings (ads, contact email). */
  settings: "settings",
  /** Privacy Policy and Terms of Use (site_pages). */
  pages: "pages",
  /** Phase 7C: live items for the breaking-news bar (/api/public/breaking). */
  breaking: "breaking",
} as const;
