import type { JSONContent } from "@tiptap/core";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageEditor } from "@/components/admin/page-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { SITE_PAGE_SLUGS, type SitePageSlug, sitePages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guards";

export const metadata: Metadata = { title: "Edit page" };

export default function EditPageAdmin({ params }: PageProps<"/admin/pages/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full bg-obsidian-raised" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: PageProps<"/admin/pages/[slug]">["params"] }) {
  await requireAdmin();
  const { slug } = await params;
  if (!(SITE_PAGE_SLUGS as readonly string[]).includes(slug)) notFound();
  const [page] = await db.select().from(sitePages).where(eq(sitePages.slug, slug as SitePageSlug)).limit(1);
  if (!page) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/admin/pages" className="text-sm text-grey hover:text-ivory">
          ← Pages
        </Link>
        <h1 className="text-3xl text-ivory">{page.titleEn}</h1>
        {page.isTemplate && (
          <p className="rounded-md border border-gold-muted/60 bg-gold/10 px-4 py-3 text-sm text-gold">
            This is the starter template. Read it carefully, change anything that doesn’t match how you run the site (ideally with a lawyer), and
            remove the “Template” paragraph at the top of each language. Saving marks the page as reviewed.
          </p>
        )}
      </div>
      <PageEditor
        slug={page.slug}
        initial={{
          titleEn: page.titleEn,
          titleUr: page.titleUr,
          bodyEn: (page.bodyEn as JSONContent | null) ?? null,
          bodyUr: (page.bodyUr as JSONContent | null) ?? null,
        }}
      />
    </div>
  );
}
