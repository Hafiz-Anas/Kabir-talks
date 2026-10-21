import type { Metadata } from "next";

import { ListingPage, listingMetadata, listingPagedParams } from "@/server/public/listing-pages";

/** Tag page N (N ≥ 2). Public URL: /{locale}/tags/{tag}?page=N, rewritten here by src/proxy.ts. */
export const ensureStatic = "navigation";

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  return (await listingPagedParams("tag", params.locale)).map(({ slug, page }) => ({ tagSlug: slug, page }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/tags/[tagSlug]/p/[page]">): Promise<Metadata> {
  const { locale, tagSlug, page } = await params;
  return listingMetadata("tag", { locale, slug: tagSlug, page });
}

export default async function TagPagedPage({ params }: PageProps<"/[locale]/tags/[tagSlug]/p/[page]">) {
  const { locale, tagSlug, page } = await params;
  return <ListingPage kind="tag" raw={{ locale, slug: tagSlug, page }} />;
}
