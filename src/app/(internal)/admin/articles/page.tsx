import { Plus, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ArticleRowActions } from "@/components/admin/article-row-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { env } from "@/lib/env";
import { formatDate, formatDateTime } from "@/lib/format";
import { absoluteUrl, articlePath } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { type ArticleListParams, articleListParamsSchema, listArticlesAdmin } from "@/server/articles";
import { listCategoriesAdmin } from "@/server/categories";

export const metadata: Metadata = { title: "Articles" };

export default function ArticlesPage({ searchParams }: PageProps<"/admin/articles">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl text-ivory">Articles</h1>
        <Button asChild className="hover:bg-gold-soft">
          <Link href="/admin/articles/new">
            <Plus aria-hidden />
            New article
          </Link>
        </Button>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <ArticleList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm text-ivory focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&>option]:bg-obsidian";

function pageHref(params: ArticleListParams, page: number) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.category) query.set("category", params.category);
  if (params.q) query.set("q", params.q);
  if (params.sort !== "updated") query.set("sort", params.sort);
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return `/admin/articles${qs ? `?${qs}` : ""}`;
}

async function ArticleList({ searchParams }: { searchParams: PageProps<"/admin/articles">["searchParams"] }) {
  await requireAdmin();
  const raw = await searchParams;
  const params = articleListParamsSchema.parse({
    status: raw.status,
    category: raw.category,
    q: typeof raw.q === "string" && raw.q.trim() ? raw.q : undefined,
    sort: raw.sort,
    page: raw.page,
  });

  const [{ rows, total, page, pageCount }, categoryRows] = await Promise.all([
    listArticlesAdmin(params),
    listCategoriesAdmin(),
  ]);
  const filtered = Boolean(params.status || params.category || params.q);

  return (
    <>
      <form method="get" action="/admin/articles" className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-obsidian p-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-grey">
          Search titles (English or Urdu)
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search…"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-ivory placeholder:text-grey-dim focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-grey">
          Status
          <select name="status" defaultValue={params.status ?? ""} className={selectClass}>
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-grey">
          Category
          <select name="category" defaultValue={params.category ?? ""} className={selectClass}>
            <option value="">All</option>
            {categoryRows.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-grey">
          Sort by
          <select name="sort" defaultValue={params.sort} className={selectClass}>
            <option value="updated">Last updated</option>
            <option value="published">Published date</option>
          </select>
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="bg-transparent">
            Apply
          </Button>
          {filtered && (
            <Button asChild variant="ghost">
              <Link href="/admin/articles">Clear</Link>
            </Button>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-gold-muted/50 bg-obsidian p-10 text-center">
          {filtered ? (
            <p className="text-grey">No articles match these filters.</p>
          ) : (
            <>
              <p className="text-lg text-ivory">No articles yet</p>
              <p className="mt-1 text-sm text-grey">Write in English, Urdu, or both.</p>
              <Button asChild className="mt-5 hover:bg-gold-soft">
                <Link href="/admin/articles/new">Write your first article</Link>
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-obsidian">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-start text-xs tracking-wide text-grey uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">Title</th>
                <th scope="col" className="hidden px-4 py-3 text-start font-medium md:table-cell">Category</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">Status</th>
                <th scope="col" className="hidden px-4 py-3 text-start font-medium lg:table-cell">Updated</th>
                <th scope="col" className="hidden px-4 py-3 text-start font-medium lg:table-cell">Published</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const firstComplete = row.titleEn && row.hasBodyEn ? "en" : row.titleUr && row.hasBodyUr ? "ur" : null;
                const publicUrl = firstComplete
                  ? absoluteUrl(env.NEXT_PUBLIC_SITE_URL, articlePath(firstComplete, row.categorySlug, row.slug))
                  : null;
                return (
                  <tr key={row.id} className="align-top">
                    <td className="max-w-md px-4 py-3">
                      <div className="flex items-start gap-2">
                        {row.isFeatured && (
                          <Star aria-label="Featured" className="mt-0.5 size-4 shrink-0 fill-gold text-gold" />
                        )}
                        <div className="min-w-0">
                          <Link href={`/admin/articles/${row.id}`} className="block text-ivory hover:text-gold-soft">
                            {row.titleEn ?? <span className="text-grey-dim italic">No English title</span>}
                          </Link>
                          {row.titleUr && (
                            <p lang="ur" dir="rtl" className="font-urdu text-sm leading-loose text-grey">
                              {row.titleUr}
                            </p>
                          )}
                          <p className="text-xs text-grey-dim md:hidden">{row.categoryNameEn}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-grey md:table-cell">{row.categoryNameEn}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap text-grey lg:table-cell">
                      {formatDateTime(row.updatedAt)}
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap text-grey lg:table-cell">
                      {formatDate(row.publishedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <ArticleRowActions
                        id={row.id}
                        title={row.titleEn ?? row.titleUr ?? row.slug}
                        status={row.status}
                        publicUrl={publicUrl}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm text-grey">
          <p>
            {total} article{total === 1 ? "" : "s"} · Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <PageLink href={pageHref(params, page - 1)} disabled={page <= 1}>
              Previous
            </PageLink>
            <PageLink href={pageHref(params, page + 1)} disabled={page >= pageCount}>
              Next
            </PageLink>
          </div>
        </nav>
      )}
    </>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const className = "rounded-md border border-border px-3 py-1.5";
  if (disabled) return <span className={cn(className, "text-grey-dim")}>{children}</span>;
  return (
    <Link href={href} className={cn(className, "text-ivory hover:border-gold-muted")}>
      {children}
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-16 bg-obsidian-raised" />
      <Skeleton className="h-96 bg-obsidian-raised" />
    </div>
  );
}
