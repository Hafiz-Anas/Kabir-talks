import type { Metadata } from "next";
import { Suspense } from "react";

import { BreakingManager, type BreakingState } from "@/components/admin/breaking-manager";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { formatDateTime } from "@/lib/format";
import { listBreakingAdmin } from "@/server/breaking";

export const metadata: Metadata = { title: "Breaking news" };

export default function BreakingPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl text-ivory">Breaking news</h1>
        <p className="text-sm text-grey">
          Live items show in a bar under the header on every public page, newest first, in the language they’re written in. Changes appear within
          about a minute.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full bg-obsidian-raised" />}>
        <Breaking />
      </Suspense>
    </div>
  );
}

async function Breaking() {
  await requireAdmin();
  const rows = await listBreakingAdmin();
  return (
    <BreakingManager
      items={rows.map((row) => {
        const state: BreakingState = !row.isActive ? "off" : row.expired ? "expired" : "live";
        return {
          id: row.id,
          textEn: row.textEn,
          textUr: row.textUr,
          articleId: row.articleId,
          articleTitle: row.articleTitle,
          articlePublished: row.articleStatus === "PUBLISHED",
          linkUrl: row.linkUrl,
          isActive: row.isActive,
          expiresAt: row.expiresAt?.toISOString() ?? null,
          expiresLabel: row.expiresAt ? formatDateTime(row.expiresAt) : null,
          createdLabel: formatDateTime(row.createdAt),
          state,
        };
      })}
    />
  );
}
