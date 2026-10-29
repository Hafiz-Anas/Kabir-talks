import type { Metadata } from "next";

import { AuthorPage, authorMetadata, authorPagedParams } from "@/server/public/author-pages";

/** Author page N (N ≥ 2). Public URL: /{locale}/author/{slug}?page=N, rewritten here by src/proxy.ts. */
export const ensureStatic = "navigation";
// Navigations wait for the (static) page rather than showing a loading shell; also
// silences the dev-only instant-navigation check for awaiting params.
export const instant = false;

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  return authorPagedParams(params.locale);
}

export async function generateMetadata({ params }: PageProps<"/[locale]/author/[authorSlug]/p/[page]">): Promise<Metadata> {
  const { locale, authorSlug, page } = await params;
  return authorMetadata({ locale, slug: authorSlug, page });
}

export default async function AuthorPagedPage({ params }: PageProps<"/[locale]/author/[authorSlug]/p/[page]">) {
  const { locale, authorSlug, page } = await params;
  return <AuthorPage raw={{ locale, slug: authorSlug, page }} />;
}
