import type { Metadata } from "next";

import { ListingPage, listingMetadata, listingSlugParams } from "@/server/public/listing-pages";

/** Articles with one tag, in the current language. Same rules as the section page. */
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  return (await listingSlugParams("tag")).map(({ slug }) => ({ tagSlug: slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/tags/[tagSlug]">): Promise<Metadata> {
  const { locale, tagSlug } = await params;
  return listingMetadata("tag", { locale, slug: tagSlug });
}

export default async function TagPage({ params }: PageProps<"/[locale]/tags/[tagSlug]">) {
  const { locale, tagSlug } = await params;
  return <ListingPage kind="tag" raw={{ locale, slug: tagSlug }} />;
}
