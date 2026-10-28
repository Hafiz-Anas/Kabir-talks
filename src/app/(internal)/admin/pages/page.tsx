import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { sitePages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guards";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Pages" };

const DESCRIPTION = {
  privacy: "What the site collects (accounts, comments, newsletter, views), cookies and Google AdSense, Gemini AI, Supabase.",
  terms: "Rules for using the site, accounts, comments, AI features and advertising.",
} as const;

export default function PagesAdminPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl text-ivory">Pages</h1>
        <p className="text-sm text-grey">
          Legal pages linked in the footer of every page, in both languages. AdSense requires a privacy policy before it approves a site.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-40 w-full bg-obsidian-raised" />}>
        <PageList />
      </Suspense>
    </div>
  );
}

async function PageList() {
  await requireAdmin();
  const rows = await db.select({ slug: sitePages.slug, titleEn: sitePages.titleEn, isTemplate: sitePages.isTemplate, updatedAt: sitePages.updatedAt }).from(sitePages);
  if (rows.length === 0) return <p className="text-sm text-grey">No pages yet. Run npm run seed to add the starter templates.</p>;

  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-obsidian">
      {rows.map((page) => (
        <li key={page.slug} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-ivory">
              {page.titleEn}
              {page.isTemplate && (
                <span className="rounded-sm border border-gold-muted px-1.5 py-0.5 text-[0.6875rem] tracking-wide text-gold uppercase">
                  Template: review before launch
                </span>
              )}
            </p>
            <p className="text-xs text-grey">{DESCRIPTION[page.slug]}</p>
            <p className="text-xs text-grey">Updated {formatDateTime(page.updatedAt)}</p>
          </div>
          <a href={`/en/${page.slug}`} target="_blank" rel="noopener" className="text-sm text-grey hover:text-ivory">
            View
          </a>
          <Link href={`/admin/pages/${page.slug}`} className="text-sm text-gold hover:text-gold-soft">
            Edit
          </Link>
        </li>
      ))}
    </ul>
  );
}
