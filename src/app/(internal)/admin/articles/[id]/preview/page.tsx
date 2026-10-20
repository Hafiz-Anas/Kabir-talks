import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { StatusBadge } from "@/components/admin/status-badge";
import { ArticleBody } from "@/components/content/article-body";
import { Skeleton } from "@/components/ui/skeleton";
import { localeState } from "@/lib/articles/rules";
import { requireAdmin } from "@/lib/auth-guards";
import { type ArticleDoc, countWords, docToPlainText, readingMinutes } from "@/lib/content/document";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getArticleForEdit } from "@/server/articles";
import { listCategoriesAdmin } from "@/server/categories";

export const metadata: Metadata = { title: "Preview" };

export default function PreviewPage({ params, searchParams }: PageProps<"/admin/articles/[id]/preview">) {
  return (
    <Suspense fallback={<Skeleton className="h-[60dvh] bg-obsidian-raised" />}>
      <Preview params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({
  params,
  searchParams,
}: Pick<PageProps<"/admin/articles/[id]/preview">, "params" | "searchParams">) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const article = await getArticleForEdit(id);
  if (!article) notFound();

  const bodies = { en: article.bodyEn as ArticleDoc | null, ur: article.bodyUr as ArticleDoc | null };
  const hasEn = localeState({ title: article.titleEn, body: bodies.en }) !== "empty";
  const hasUr = localeState({ title: article.titleUr, body: bodies.ur }) !== "empty";
  const requested = query.lang === "ur" ? "ur" : query.lang === "en" ? "en" : null;
  const locale: "en" | "ur" = requested ?? (hasEn || !hasUr ? "en" : "ur");

  const category = (await listCategoriesAdmin()).find((c) => c.id === article.categoryId);
  const title = locale === "en" ? article.titleEn : article.titleUr;
  const excerpt = locale === "en" ? article.excerptEn : article.excerptUr;
  const words = countWords(docToPlainText(bodies[locale]));
  const minutes = readingMinutes(words, locale);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-gold-muted/60 bg-gold/5 px-4 py-3 text-sm">
        <Link href={`/admin/articles/${article.id}`} className="inline-flex items-center gap-1 text-grey hover:text-ivory">
          <ArrowLeft aria-hidden className="size-4" /> Back to editor
        </Link>
        <span className="text-gold">Preview — only admins can see this page.</span>
        <StatusBadge status={article.status} />
        <nav aria-label="Preview language" className="ms-auto flex gap-1">
          {(["en", "ur"] as const).map((l) => (
            <Link
              key={l}
              href={`?lang=${l}`}
              aria-current={l === locale ? "page" : undefined}
              className={cn(
                "rounded-sm px-3 py-1",
                l === locale ? "bg-obsidian-raised text-gold" : "text-grey hover:text-ivory",
                l === "ur" && "font-urdu",
              )}
            >
              {l === "en" ? "English" : "اردو"}
            </Link>
          ))}
        </nav>
      </div>

      <article lang={locale} dir={locale === "ur" ? "rtl" : "ltr"} className={cn("mx-auto max-w-3xl space-y-6", locale === "ur" && "font-urdu")}>
        <header className="space-y-4">
          {category && (
            <p className="text-sm tracking-wide text-gold uppercase">{locale === "en" ? category.nameEn : category.nameUr}</p>
          )}
          {title ? (
            <h1 className="text-4xl text-ivory sm:text-5xl">{title}</h1>
          ) : (
            <p className="text-grey italic" dir="ltr" lang="en">
              No {locale === "en" ? "English" : "Urdu"} title yet.
            </p>
          )}
          {excerpt && <p className="text-lg text-grey">{excerpt}</p>}
          <p className="text-sm text-grey-dim" dir="ltr" lang="en">
            {article.publishedAt ? formatDate(article.publishedAt) : "Not published"} · {minutes} min read
          </p>
        </header>

        {article.coverImageUrl && (
          <figure>
            <Image
              src={article.coverImageUrl}
              alt={article.coverImageAlt ?? ""}
              width={1200}
              height={675}
              className="aspect-video w-full rounded-md object-cover"
              priority
            />
          </figure>
        )}

        {bodies[locale] ? (
          <ArticleBody doc={bodies[locale]} locale={locale} />
        ) : (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-grey" dir="ltr" lang="en">
            The {locale === "en" ? "English" : "Urdu"} body is empty.
          </p>
        )}
      </article>
    </div>
  );
}
