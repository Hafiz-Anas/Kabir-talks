import { locales } from "@/i18n/config";
import { formatPublicDate } from "@/lib/format";
import { articlePath } from "@/lib/urls";
import { getPublishedArticle } from "@/server/public/articles";

/**
 * GET /api/public/article-locales/{slug}
 * Which languages a PUBLISHED article is available in, with the title, URL
 * and date of each. Used by the article 404 page to say "only available in
 * English/Urdu". Drafts, archived and unknown slugs → 404 (nothing leaks).
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/public/article-locales/[slug]">) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return Response.json({ error: "Not found" }, { status: 404 });

  const versions = Object.fromEntries(
    locales.flatMap((locale) => {
      const content = article.locales[locale];
      if (!content) return [];
      return [
        [
          locale,
          {
            title: content.title,
            category: content.categoryName,
            href: articlePath(locale, article.categorySlug, article.slug),
            date: formatPublicDate(article.publishedAt, locale),
          },
        ],
      ];
    }),
  );
  return Response.json({ versions });
}
