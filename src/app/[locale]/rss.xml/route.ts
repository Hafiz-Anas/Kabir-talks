import { getDictionary, isLocale } from "@/i18n";
import { siteUrl } from "@/lib/seo";
import { articlePath } from "@/lib/urls";
import { xmlEscape } from "@/lib/xml";
import { listArticleCards } from "@/server/public/articles";

/** /en/rss.xml and /ur/rss.xml (Phase 7): the 30 newest stories available in that language (RSS 2.0). */

const RSS_SIZE = 30;

export async function GET(_request: Request, { params }: RouteContext<"/[locale]/rss.xml">) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404 });
  const dict = getDictionary(locale);
  const cards = await listArticleCards({ locale, limit: RSS_SIZE });
  const self = siteUrl(`/${locale}/rss.xml`);

  const items = cards
    .map((card) => {
      const url = siteUrl(articlePath(locale, card.categorySlug, card.slug));
      return `    <item>
      <title>${xmlEscape(card.title)}</title>
      <link>${xmlEscape(url)}</link>
      <guid isPermaLink="true">${xmlEscape(url)}</guid>
      <pubDate>${new Date(card.publishedAt).toUTCString()}</pubDate>
      <category>${xmlEscape(card.categoryName)}</category>${card.excerpt ? `\n      <description>${xmlEscape(card.excerpt)}</description>` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(`${dict.site.name} — ${dict.home.title}`)}</title>
    <link>${xmlEscape(siteUrl(`/${locale}`))}</link>
    <description>${xmlEscape(dict.site.description)}</description>
    <language>${locale}</language>
    <atom:link href="${xmlEscape(self)}" rel="self" type="application/rss+xml"/>${cards[0] ? `\n    <lastBuildDate>${new Date(cards[0].publishedAt).toUTCString()}</lastBuildDate>` : ""}
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=600" } });
}
