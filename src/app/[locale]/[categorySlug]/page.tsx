import type { Metadata } from "next";

import { ListingPage, listingMetadata, listingSlugParams } from "@/server/public/listing-pages";

/**
 * Section page 1: lead story, then a grid. Later pages are ?page=N, which
 * src/proxy.ts rewrites to ./p/[page]. Fully static from cached reads, so an
 * unknown section renders to a real 404 (see src/server/public/listing-pages.tsx).
 */
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  return (await listingSlugParams("category")).map(({ slug }) => ({ categorySlug: slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/[categorySlug]">): Promise<Metadata> {
  const { locale, categorySlug } = await params;
  return listingMetadata("category", { locale, slug: categorySlug });
}

export default async function CategoryPage({ params }: PageProps<"/[locale]/[categorySlug]">) {
  const { locale, categorySlug } = await params;
  return <ListingPage kind="category" raw={{ locale, slug: categorySlug }} />;
}
