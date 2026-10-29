import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthorManager } from "@/components/admin/author-manager";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { features } from "@/lib/features";
import { listAuthorsAdmin } from "@/server/authors";

export const metadata: Metadata = { title: "Authors" };

export default function AuthorsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl text-ivory">Authors</h1>
        <p className="text-sm text-grey">
          Profiles shown on bylines and author pages. They are not logins. The main author is preselected for new articles.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full bg-obsidian-raised" />}>
        <Authors />
      </Suspense>
    </div>
  );
}

async function Authors() {
  await requireAdmin();
  const authors = await listAuthorsAdmin();
  return <AuthorManager authors={authors} uploadsEnabled={features.storageEnabled} />;
}
