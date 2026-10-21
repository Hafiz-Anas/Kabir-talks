import type { Metadata } from "next";

import { ListingPage, listingMetadata, listingPagedParams } from "@/server/public/listing-pages";

/**
 * Section page N (N ≥ 2). Public URL: /{locale}/{section}?page=N — src/proxy.ts
 * rewrites it here so the page can be static and 404 properly when out of range.
 * Its canonical URL is the ?page form (set in listingMetadata).
 */
export const ensureStatic = "navigation";

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  return (await listingPagedParams("category", params.locale)).map(({ slug, page }) => ({ categorySlug: slug, page }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/[categorySlug]/p/[page]">): Promise<Metadata> {
  const { locale, categorySlug, page } = await params;
  return listingMetadata("category", { locale, slug: categorySlug, page });
}

export default async function CategoryPagedPage({ params }: PageProps<"/[locale]/[categorySlug]/p/[page]">) {
  const { locale, categorySlug, page } = await params;
  return <ListingPage kind="category" raw={{ locale, slug: categorySlug, page }} />;
}
