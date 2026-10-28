import type { Metadata } from "next";

import { LegalPage, legalMetadata } from "@/components/legal-page";

// Must stay fully static (cached reads only): AdSense reviewers and readers land here.
export const ensureStatic = "navigation";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  return legalMetadata("terms", (await params).locale);
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  return <LegalPage slug="terms" rawLocale={(await params).locale} />;
}
