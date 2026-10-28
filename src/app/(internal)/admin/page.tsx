import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ComingSoon } from "@/components/coming-soon";
import { AiStatusCard } from "@/components/admin/ai/ai-status-card";
import { DailyBarChart, DailyLineChart } from "@/components/admin/charts";
import { StatusBadge } from "@/components/admin/status-badge";
import { aiStatus } from "@/lib/ai/config";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { emailDriver, emailTestMode, features } from "@/lib/features";
import { formatDateTime } from "@/lib/format";
import { getAiUsageToday } from "@/server/ai/limits";
import { dailyViews, topArticles, viewsByCategory, viewTotals } from "@/server/analytics";
import { getDashboardData } from "@/server/articles";
import { pendingCommentCount } from "@/server/comments";
import { newSubscribersSince, subscriberCounts, subscriberGrowth } from "@/server/newsletter/admin";

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
  const [{ stats, recent }, pendingComments, aiUsage, readers] = await Promise.all([
    getDashboardData(),
    pendingCommentCount(),
    getAiUsageToday(),
    readerStats(),
  ]);

  const cards = [
    { label: "Total articles", value: stats.total, href: "/admin/articles" },
    { label: "Published", value: stats.published, href: "/admin/articles?status=PUBLISHED" },
    { label: "Drafts", value: stats.drafts, href: "/admin/articles?status=DRAFT" },
    { label: "Categories", value: stats.categories, href: "/admin/categories" },
    { label: "Pending comments", value: pendingComments, href: "/admin/comments" },
  ];

  const flags = [
    { label: "Image uploads (Supabase Storage)", enabled: features.storageEnabled },
    { label: "Google sign-in", enabled: features.googleAuthEnabled },
    {
      label: "Email sending (Resend)",
      enabled: emailDriver === "resend",
      note: emailTestMode ? "Test mode: emails go to the outbox only" : undefined,
    },
  ] as { label: string; enabled: boolean; note?: string }[];

  return (
    <>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-5">
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

      <Readers {...readers} />

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

      <AiStatusCard status={aiStatus} usage={aiUsage} />

      <section aria-labelledby="flags" className="space-y-4">
        <h2 id="flags" className="text-xl text-ivory">
          Optional features
        </h2>
        <ul className="divide-y divide-border rounded-md border border-border bg-obsidian">
          {flags.map((flag) => (
            <li key={flag.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span>{flag.label}</span>
              {flag.enabled ? (
                <span className="text-gold">Enabled</span>
              ) : flag.note ? (
                <Link href="/admin/emails" className="text-end text-gold hover:text-gold-soft">
                  {flag.note}
                </Link>
              ) : (
                <ComingSoon label="Not configured" />
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

async function readerStats() {
  const [totals, daily, top, byCategory, subscribers, growth, newSubscribers] = await Promise.all([
    viewTotals(),
    dailyViews(30),
    topArticles(30, 10),
    viewsByCategory(30),
    subscriberCounts(),
    subscriberGrowth(30),
    newSubscribersSince(new Date(Date.now() - 30 * 86_400_000)),
  ]);
  return { totals, daily, top, byCategory, subscribers, growth, newSubscribers };
}

/** Views (counted once per reader per article per day; admins and bots excluded) and newsletter growth. */
function Readers({ totals, daily, top, byCategory, subscribers, growth, newSubscribers }: Awaited<ReturnType<typeof readerStats>>) {
  const tiles = [
    { label: "Views today", value: totals.today },
    { label: "Views, 7 days", value: totals.week },
    { label: "Views, 30 days", value: totals.month },
    { label: "Newsletter subscribers", value: subscribers.active, note: newSubscribers ? `+${newSubscribers} in 30 days` : undefined, href: "/admin/newsletter" },
  ];
  const categoryMax = Math.max(1, ...byCategory.map((c) => c.views));

  return (
    <section aria-labelledby="readers" className="space-y-6">
      <div className="space-y-1">
        <h2 id="readers" className="text-xl text-ivory">
          Readers
        </h2>
        <p className="text-sm text-grey">Each reader counts once per article per day. Admins, bots and link previews aren’t counted. Days are Pakistan time.</p>
      </div>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => {
          const body = (
            <>
              <p className="text-sm text-grey">{tile.label}</p>
              <p className="mt-2 font-serif text-4xl text-ivory tabular-nums">{tile.value.toLocaleString("en-GB")}</p>
              {tile.note && <p className="mt-1 text-xs text-gold">{tile.note}</p>}
            </>
          );
          return (
            <li key={tile.label}>
              {tile.href ? (
                <Link href={tile.href} className="block rounded-md border border-border bg-obsidian p-5 transition-colors hover:border-gold-muted">
                  {body}
                </Link>
              ) : (
                <div className="rounded-md border border-border bg-obsidian p-5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="space-y-2 rounded-md border border-border bg-obsidian p-5">
        <h3 className="font-sans text-sm text-ivory">Views per day, last 30 days</h3>
        <DailyBarChart title="Views per day" unit="Views" points={daily.map((d) => ({ date: d.date, value: d.views }))} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-md border border-border bg-obsidian p-5">
          <h3 className="font-sans text-sm text-ivory">Top articles, 30 days</h3>
          {top.length === 0 ? (
            <p className="text-sm text-grey">No views yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {top.map((article, index) => (
                <li key={article.id} className="flex items-baseline gap-3">
                  <span className="w-5 shrink-0 text-end text-grey tabular-nums">{index + 1}</span>
                  <Link href={`/admin/articles/${article.id}`} className="min-w-0 flex-1 truncate text-ivory hover:text-gold-soft">
                    {article.titleEn ?? (
                      <span lang="ur" dir="rtl" className="font-urdu">
                        {article.titleUr}
                      </span>
                    )}
                  </Link>
                  {article.status !== "PUBLISHED" && <StatusBadge status={article.status} />}
                  <span className="text-ivory tabular-nums">{article.views.toLocaleString("en-GB")}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="space-y-3 rounded-md border border-border bg-obsidian p-5">
          <h3 className="font-sans text-sm text-ivory">Views per category, 30 days</h3>
          <ul className="space-y-3 text-sm">
            {byCategory.map((category) => (
              <li key={category.id} className="space-y-1">
                <div className="flex justify-between gap-3">
                  <span className="text-grey">{category.nameEn}</span>
                  <span className="text-ivory tabular-nums">{category.views.toLocaleString("en-GB")}</span>
                </div>
                <div className="h-1.5 rounded-full bg-obsidian-raised" aria-hidden>
                  <div className="h-full rounded-full bg-gold" style={{ width: `${(category.views / categoryMax) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-obsidian p-5">
        <h3 className="font-sans text-sm text-ivory">Active newsletter subscribers, last 30 days</h3>
        <DailyLineChart title="Active newsletter subscribers" unit="Subscribers" points={growth.map((g) => ({ date: g.day, value: g.active }))} />
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 bg-obsidian-raised" />
        ))}
      </div>
      <Skeleton className="h-64 bg-obsidian-raised" />
    </div>
  );
}
