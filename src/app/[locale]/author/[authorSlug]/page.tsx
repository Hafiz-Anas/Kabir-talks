import type { Metadata } from "next";

import { AuthorPage, authorMetadata, authorSlugParams } from "@/server/public/author-pages";

/** Phase 7C: an author's profile and their articles in the current language. Same rules as the section pages. */
export const ensureStatic = "navigation";
// Navigations wait for the (static) page rather than showing a loading shell; also
// silences the dev-only instant-navigation check for awaiting params.
export const instant = false;

export async function generateStaticParams() {
  return authorSlugParams();
}

export async function generateMetadata({ params }: PageProps<"/[locale]/author/[authorSlug]">): Promise<Metadata> {
  const { locale, authorSlug } = await params;
  return authorMetadata({ locale, slug: authorSlug });
}

export default async function AuthorProfilePage({ params }: PageProps<"/[locale]/author/[authorSlug]">) {
  const { locale, authorSlug } = await params;
  return <AuthorPage raw={{ locale, slug: authorSlug }} />;
}
