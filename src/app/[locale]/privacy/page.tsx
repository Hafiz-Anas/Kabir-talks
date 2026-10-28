import type { Metadata } from "next";

import { LegalPage, legalMetadata } from "@/components/legal-page";

// Must stay fully static (cached reads only): AdSense reviewers and readers land here.
export const ensureStatic = "navigation";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  return legalMetadata("privacy", (await params).locale);
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  return <LegalPage slug="privacy" rawLocale={(await params).locale} />;
}
