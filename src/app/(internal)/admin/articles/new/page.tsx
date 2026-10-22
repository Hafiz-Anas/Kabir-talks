import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ArticleEditor } from "@/components/admin/editor/article-editor";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth-guards";
import { env } from "@/lib/env";
import { features } from "@/lib/features";
import { getEditorOptions } from "@/server/articles";
import { imagePrefix } from "@/server/storage";

import { EditorSkeleton } from "../editor-skeleton";

export const metadata: Metadata = { title: "New article" };

export default function NewArticlePage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NewArticle />
    </Suspense>
  );
}

async function NewArticle() {
  await requireAdmin();
  const options = await getEditorOptions();

  if (options.categories.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gold-muted/50 bg-obsidian p-10 text-center">
        <p className="text-ivory">Create a category before writing an article.</p>
        <Button asChild className="mt-4 hover:bg-gold-soft">
          <Link href="/admin/categories">Go to categories</Link>
        </Button>
      </div>
    );
  }

  return (
    <ArticleEditor
      initial={{
        status: "DRAFT",
        publishedAt: null,
        titleEn: "",
        titleUr: "",
        excerptEn: "",
        excerptUr: "",
        bodyEn: null,
        bodyUr: null,
        categoryId: options.categories[0].id,
        slug: "",
        tags: [],
        coverImageUrl: null,
        coverImageAlt: "",
        isFeatured: false,
        commentsEnabled: true,
        seoTitleEn: "",
        seoTitleUr: "",
        seoDescriptionEn: "",
        seoDescriptionUr: "",
        aiReviewPending: false,
      }}
      categories={options.categories}
      tagOptions={options.tags}
      uploadsEnabled={features.storageEnabled}
      imagePrefix={imagePrefix()}
      siteUrl={env.NEXT_PUBLIC_SITE_URL}
      aiEnabled={features.aiEnabled}
    />
  );
}
