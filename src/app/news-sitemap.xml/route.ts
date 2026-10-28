import { getDictionary, locales } from "@/i18n";
import { siteUrl } from "@/lib/seo";
import { articlePath } from "@/lib/urls";
import { xmlEscape } from "@/lib/xml";
import { listNewsArticles } from "@/server/public/seo";

/**
 * /news-sitemap.xml (Phase 7): Google News sitemap, articles published in
 * the last 48 hours, one entry per language version.
 * https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
 */
export async function GET() {
  const rows = await listNewsArticles();
  const urls = rows.flatMap((article) =>
    locales
      .filter((l) => article[l])
      .map((l) => {
        const title = (l === "en" ? article.titleEn : article.titleUr) ?? "";
        return `  <url>
    <loc>${xmlEscape(siteUrl(articlePath(l, article.categorySlug, article.slug)))}</loc>
    <news:news>
      <news:publication>
        <news:name>${xmlEscape(getDictionary(l).site.name)}</news:name>
        <news:language>${l}</news:language>
      </news:publication>
      <news:publication_date>${article.publishedAt!.toISOString()}</news:publication_date>
      <news:title>${xmlEscape(title.trim())}</news:title>
    </news:news>
  </url>`;
      }),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls.join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=600" } });
}
