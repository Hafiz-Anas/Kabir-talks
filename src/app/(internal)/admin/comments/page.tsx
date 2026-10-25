import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { ModerationList } from "@/components/admin/moderation-list";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { articlePath } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { listForModeration, moderationCounts, type ModerationStatus } from "@/server/comments";

export const metadata: Metadata = { title: "Comments" };

const TABS: { status: ModerationStatus; label: string; param: string }[] = [
  { status: "PENDING", label: "Pending", param: "pending" },
  { status: "APPROVED", label: "Approved", param: "approved" },
  { status: "REJECTED", label: "Rejected", param: "rejected" },
];

const paramsSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).catch("pending"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export default function CommentsPage({ searchParams }: PageProps<"/admin/comments">) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl text-ivory">Comments</h1>
        <p className="text-sm text-grey">
          Reader comments wait here until you approve them. Approved comments appear on the article straight away, in both languages.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full bg-obsidian-raised" />}>
        <Moderation searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Moderation({ searchParams }: { searchParams: PageProps<"/admin/comments">["searchParams"] }) {
  await requireAdmin();
  const params = paramsSchema.parse(await searchParams);
  const tab = TABS.find((t) => t.param === params.status)!;
  const [counts, { rows, total, pages }] = await Promise.all([moderationCounts(), listForModeration(tab.status, params.page)]);
  const href = (param: string, page = 1) => `/admin/comments?status=${param}${page > 1 ? `&page=${page}` : ""}`;

  const items = rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    edited: row.editedAt !== null,
    isReply: row.parentId !== null,
    parentExcerpt: row.parentBody ? row.parentBody.slice(0, 140) : null,
    author: row.userId
      ? { id: row.userId, name: row.authorName ?? "", email: row.authorEmail ?? "", isAdmin: row.authorRole === "admin", blocked: Boolean(row.authorBlocked) }
      : null,
    article: {
      title: row.titleEn ?? row.titleUr ?? row.articleSlug,
      urdu: !row.titleEn,
      href:
        row.articleStatus === "PUBLISHED"
          ? articlePath(row.titleEn ? "en" : "ur", row.categorySlug, row.articleSlug)
          : `/admin/articles/${row.articleId}`,
      published: row.articleStatus === "PUBLISHED",
    },
  }));

  return (
    <div className="space-y-5">
      <nav aria-label="Comment status" className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.param}
            href={href(t.param)}
            aria-current={t.param === tab.param ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
              t.param === tab.param ? "border-gold text-gold" : "border-transparent text-grey hover:text-ivory",
            )}
          >
            {t.label}
            <span className="rounded-sm bg-obsidian-raised px-1.5 text-xs tabular-nums text-ivory">{counts[t.status]}</span>
          </Link>
        ))}
      </nav>

      <ModerationList
        key={`${tab.param}-${params.page}`}
        status={tab.status}
        items={items}
        emptyText={tab.status === "PENDING" ? "Nothing waiting for review." : `No ${tab.label.toLowerCase()} comments.`}
      />

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {params.page > 1 ? <Link href={href(tab.param, params.page - 1)} className="text-gold hover:text-gold-soft">← Previous</Link> : <span />}
          <span className="text-grey">
            Page {params.page} of {pages} · {total} comments
          </span>
          {params.page < pages ? <Link href={href(tab.param, params.page + 1)} className="text-gold hover:text-gold-soft">Next →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
