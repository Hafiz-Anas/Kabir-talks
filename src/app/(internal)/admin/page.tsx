import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ComingSoon } from "@/components/coming-soon";
import { AiStatusCard } from "@/components/admin/ai/ai-status-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { aiStatus } from "@/lib/ai/config";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { features } from "@/lib/features";
import { formatDateTime } from "@/lib/format";
import { getDashboardData } from "@/server/articles";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl text-ivory">Dashboard</h1>
        <Button asChild size="lg" className="hover:bg-gold-soft">
          <Link href="/admin/articles/new">
            <Plus aria-hidden />
            New article
          </Link>
        </Button>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

async function Dashboard() {
  await requireAdmin();
  const { stats, recent } = await getDashboardData();

  const cards = [
    { label: "Total articles", value: stats.total, href: "/admin/articles" },
    { label: "Published", value: stats.published, href: "/admin/articles?status=PUBLISHED" },
    { label: "Drafts", value: stats.drafts, href: "/admin/articles?status=DRAFT" },
    { label: "Categories", value: stats.categories, href: "/admin/categories" },
  ];

  const flags = [
    { label: "Image uploads (Supabase Storage)", enabled: features.storageEnabled },
    { label: "Google sign-in", enabled: features.googleAuthEnabled },
    { label: "Newsletter (Resend)", enabled: features.newsletterEnabled },
  ];

  return (
    <>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <li key={card.label}>
            <Link
              href={card.href}
              className="block rounded-md border border-border bg-obsidian p-5 transition-colors hover:border-gold-muted"
            >
              <p className="text-sm text-grey">{card.label}</p>
              <p className="mt-2 font-serif text-4xl text-ivory">{card.value}</p>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="recent" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="recent" className="text-xl text-ivory">
            Recent articles
          </h2>
          <Link href="/admin/articles" className="text-sm text-gold hover:text-gold-soft">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-md border border-dashed border-gold-muted/50 bg-obsidian p-8 text-center">
            <p className="text-grey">No articles yet.</p>
            <Button asChild className="mt-4 hover:bg-gold-soft">
              <Link href="/admin/articles/new">Write your first article</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-obsidian">
            {recent.map((article) => (
              <li key={article.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/articles/${article.id}`} className="block truncate text-ivory hover:text-gold-soft">
                    {article.titleEn ?? (
                      <span lang="ur" dir="rtl" className="font-urdu">
                        {article.titleUr}
                      </span>
                    )}
                  </Link>
                  <p className="text-xs text-grey">
                    {article.categoryNameEn} · Updated {formatDateTime(article.updatedAt)}
                  </p>
                </div>
                <StatusBadge status={article.status} />
                <Link href={`/admin/articles/${article.id}`} className="text-sm text-gold hover:text-gold-soft">
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AiStatusCard status={aiStatus} />

      <section aria-labelledby="flags" className="space-y-4">
        <h2 id="flags" className="text-xl text-ivory">
          Optional features
        </h2>
        <ul className="divide-y divide-border rounded-md border border-border bg-obsidian">
          {flags.map((flag) => (
            <li key={flag.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span>{flag.label}</span>
              {flag.enabled ? <span className="text-gold">Enabled</span> : <ComingSoon label="Not configured" />}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 bg-obsidian-raised" />
        ))}
      </div>
      <Skeleton className="h-64 bg-obsidian-raised" />
    </div>
  );
}
