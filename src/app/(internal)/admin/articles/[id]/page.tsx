import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ArticleEditor } from "@/components/admin/editor/article-editor";
import { requireAdmin } from "@/lib/auth-guards";
import type { ArticleDoc } from "@/lib/content/document";
import { env } from "@/lib/env";
import { features } from "@/lib/features";
import { getArticleForEdit, getEditorOptions } from "@/server/articles";
import { imagePrefix } from "@/server/storage";

import { EditorSkeleton } from "../editor-skeleton";

export const metadata: Metadata = { title: "Edit article" };

export default function EditArticlePage({ params }: PageProps<"/admin/articles/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditArticle params={params} />
    </Suspense>
  );
}

async function EditArticle({ params }: { params: PageProps<"/admin/articles/[id]">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  const [article, options] = await Promise.all([getArticleForEdit(id), getEditorOptions()]);
  if (!article) notFound();

  return (
    <ArticleEditor
      // Remount if the route switches to another article.
      key={article.id}
      initial={{
        id: article.id,
        status: article.status,
        publishedAt: article.publishedAt?.toISOString() ?? null,
        titleEn: article.titleEn ?? "",
        titleUr: article.titleUr ?? "",
        excerptEn: article.excerptEn ?? "",
        excerptUr: article.excerptUr ?? "",
        bodyEn: (article.bodyEn as ArticleDoc | null) ?? null,
        bodyUr: (article.bodyUr as ArticleDoc | null) ?? null,
        categoryId: article.categoryId,
        slug: article.slug,
        tags: article.tags.map((tag) => ({ id: tag.id, nameEn: tag.nameEn, nameUr: tag.nameUr })),
        coverImageUrl: article.coverImageUrl,
        coverImageAlt: article.coverImageAlt ?? "",
        isFeatured: article.isFeatured,
        seoTitleEn: article.seoTitleEn ?? "",
        seoTitleUr: article.seoTitleUr ?? "",
        seoDescriptionEn: article.seoDescriptionEn ?? "",
        seoDescriptionUr: article.seoDescriptionUr ?? "",
      }}
      categories={options.categories}
      tagOptions={options.tags}
      uploadsEnabled={features.storageEnabled}
      imagePrefix={imagePrefix()}
      siteUrl={env.NEXT_PUBLIC_SITE_URL}
    />
  );
}
