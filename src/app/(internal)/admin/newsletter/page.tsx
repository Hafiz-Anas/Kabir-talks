import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { ProcessNowButton, RemoveSubscriberButton, SendDigestButton } from "@/components/admin/newsletter-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { features } from "@/lib/features";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listSubscribers, subscriberCounts, type SubscriberStatus } from "@/server/newsletter/admin";
import { eligibleLanguages, newsletterEmail } from "@/server/newsletter/emails";
import { digestPayload, digestWeek, listSends } from "@/server/newsletter/sends";

export const metadata: Metadata = { title: "Newsletter" };

const paramsSchema = z.object({
  q: z.string().trim().max(254).optional().catch(undefined),
  status: z.enum(["ACTIVE", "PENDING", "UNSUBSCRIBED"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  preview: z.enum(["en", "ur", "both"]).catch("en"),
});

const STATUS_LABEL: Record<SubscriberStatus, string> = { ACTIVE: "Active", PENDING: "Waiting for confirmation", UNSUBSCRIBED: "Unsubscribed" };
const LANGUAGE_LABEL = { en: "English", ur: "Urdu", both: "Both" } as const;

export default function NewsletterAdminPage({ searchParams }: PageProps<"/admin/newsletter">) {
  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-3xl text-ivory">Newsletter</h1>
        <p className="text-sm text-grey">
          Readers sign up on the site and confirm by email. Only confirmed (active) subscribers receive newsletters.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full bg-obsidian-raised" />}>
        <Newsletter searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Newsletter({ searchParams }: { searchParams: PageProps<"/admin/newsletter">["searchParams"] }) {
  await requireAdmin();
  const params = paramsSchema.parse(await searchParams);
  const [counts, sends, subscribers, digest] = await Promise.all([
    subscriberCounts(),
    listSends(),
    listSubscribers({ q: params.q, status: params.status, page: params.page }),
    digestPayload(),
  ]);
  const week = digestWeek();
  const digestSent = sends.some((send) => send.dedupeKey === `digest:${week}`);
  const digestLanguages = eligibleLanguages(digest);
  const digestRecipients = digestLanguages.reduce((sum, l) => sum + counts.byLanguage[l], 0);
  const waiting = sends.reduce((sum, send) => sum + (send.waiting ?? 0), 0);
  const preview = newsletterEmail(
    { id: "preview", kind: "digest", payload: digest },
    { id: "00000000-0000-4000-8000-000000000000", email: "preview@example.com", locale: params.preview === "ur" ? "ur" : "en", language: params.preview },
  );

  const query = (changes: Record<string, string | number | undefined>) => {
    const merged = { q: params.q, status: params.status, page: params.page > 1 ? params.page : undefined, preview: params.preview === "en" ? undefined : params.preview, ...changes };
    const search = new URLSearchParams(Object.entries(merged).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
    return `/admin/newsletter${search.size ? `?${search}` : ""}`;
  };

  return (
    <>
      {!features.newsletterEnabled && (
        <p className="rounded-md border border-gold-muted/50 bg-obsidian px-4 py-3 text-sm text-grey">
          <span className="text-gold">Sign-up is switched off</span> until email sending is set up (RESEND_API_KEY and EMAIL_FROM). The sign-up box is hidden on the site meanwhile.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Active subscribers", value: counts.active, href: query({ status: "ACTIVE", page: undefined }) },
          { label: "Waiting for confirmation", value: counts.pending, href: query({ status: "PENDING", page: undefined }) },
          { label: "Unsubscribed", value: counts.unsubscribed, href: query({ status: "UNSUBSCRIBED", page: undefined }) },
        ].map((card) => (
          <li key={card.label}>
            <Link href={card.href} className="block rounded-md border border-border bg-obsidian p-5 transition-colors hover:border-gold-muted">
              <p className="text-sm text-grey">{card.label}</p>
              <p className="mt-2 font-serif text-4xl text-ivory">{card.value}</p>
            </Link>
          </li>
        ))}
        <li className="rounded-md border border-border bg-obsidian p-5 text-sm">
          <p className="text-grey">Active, by language</p>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
            {(["en", "ur", "both"] as const).map((l) => (
              <div key={l} className="contents">
                <dt className="text-grey">{LANGUAGE_LABEL[l]}</dt>
                <dd className="text-end text-ivory tabular-nums">{counts.byLanguage[l]}</dd>
              </div>
            ))}
          </dl>
        </li>
      </ul>

      <section aria-labelledby="sends" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 id="sends" className="text-xl text-ivory">
              Sends
            </h2>
            <p className="text-sm text-grey">
              Emails go out in small batches, run by <code className="text-ivory">npm run newsletter:process</code> or the server’s cron job.
            </p>
          </div>
          <ProcessNowButton waiting={waiting} />
        </div>
        {sends.length === 0 ? (
          <p className="rounded-md border border-dashed border-gold-muted/50 bg-obsidian p-6 text-center text-sm text-grey">
            Nothing sent yet. Send an article from its editor (Newsletter panel), or send the weekly digest below.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-obsidian text-start text-grey">
                <tr>
                  <th scope="col" className="px-4 py-2 text-start font-normal">What</th>
                  <th scope="col" className="px-4 py-2 text-start font-normal">Queued</th>
                  <th scope="col" className="px-4 py-2 text-end font-normal">Sent</th>
                  <th scope="col" className="px-4 py-2 text-end font-normal">Waiting</th>
                  <th scope="col" className="px-4 py-2 text-end font-normal">Failed</th>
                  <th scope="col" className="px-4 py-2 text-end font-normal">Skipped</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sends.map((send) => {
                  const title = send.kind === "digest" ? `Weekly digest ${send.dedupeKey.slice(7)}` : (send.payload.en?.subject ?? send.payload.ur?.subject ?? "Article");
                  return (
                    <tr key={send.id}>
                      <td className="max-w-80 truncate px-4 py-2 text-ivory" dir="auto">
                        {title}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-grey">{formatDateTime(send.createdAt)}</td>
                      <td className="px-4 py-2 text-end tabular-nums">
                        {send.sent ?? 0} / {send.recipients}
                      </td>
                      <td className="px-4 py-2 text-end tabular-nums">{send.waiting ?? 0}</td>
                      <td className={cn("px-4 py-2 text-end tabular-nums", (send.failed ?? 0) > 0 && "text-destructive")}>{send.failed ?? 0}</td>
                      <td className="px-4 py-2 text-end tabular-nums text-grey">{send.skipped ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="digest" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 id="digest" className="text-xl text-ivory">
              Weekly digest · {week}
            </h2>
            <p className="text-sm text-grey">
              The most-read stories of the last 7 days in each language. Preview what each group of subscribers will get, then send it (once per week).
            </p>
          </div>
          {features.newsletterEnabled && <SendDigestButton week={week} recipients={digestRecipients} alreadySent={digestSent} />}
        </div>
        <nav aria-label="Preview for" className="flex flex-wrap gap-2 text-sm">
          {(["en", "ur", "both"] as const).map((l) => (
            <Link
              key={l}
              href={query({ preview: l === "en" ? undefined : l })}
              scroll={false}
              aria-current={params.preview === l ? "page" : undefined}
              className={cn(
                "rounded-sm border px-3 py-1",
                params.preview === l ? "border-gold bg-gold/10 text-gold" : "border-border text-grey hover:text-ivory",
              )}
            >
              {LANGUAGE_LABEL[l]} subscribers
            </Link>
          ))}
        </nav>
        {preview ? (
          <iframe
            title={`Digest preview for ${LANGUAGE_LABEL[params.preview]} subscribers`}
            sandbox=""
            srcDoc={preview.html}
            className="h-[34rem] w-full rounded-md border border-border bg-black"
          />
        ) : (
          <p className="rounded-md border border-dashed border-gold-muted/50 bg-obsidian p-6 text-center text-sm text-grey">
            No stories for these subscribers this week yet.
          </p>
        )}
      </section>

      <section aria-labelledby="subscribers" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="subscribers" className="text-xl text-ivory">
            Subscribers
          </h2>
          <div className="flex flex-wrap gap-3 text-sm">
            {/* File downloads: plain links (download), not client navigation. */}
            <a href="/api/admin/newsletter/export?status=ACTIVE" download className="inline-flex items-center gap-1.5 text-gold hover:text-gold-soft">
              <Download aria-hidden className="size-4" /> Export active (CSV)
            </a>
            <a href="/api/admin/newsletter/export" download className="inline-flex items-center gap-1.5 text-gold hover:text-gold-soft">
              <Download aria-hidden className="size-4" /> Export all (CSV)
            </a>
          </div>
        </div>

        <form action="/admin/newsletter" className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="q" className="text-xs text-grey">
              Search email
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={params.q}
              className="h-9 w-64 max-w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="status" className="text-xs text-grey">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={params.status ?? ""}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&>option]:bg-obsidian"
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Waiting for confirmation</option>
              <option value="UNSUBSCRIBED">Unsubscribed</option>
            </select>
          </div>
          <button type="submit" className="h-9 rounded-md border border-border px-4 text-sm text-ivory hover:border-gold-muted">
            Search
          </button>
          {(params.q || params.status) && (
            <Link href="/admin/newsletter" className="h-9 py-2 text-sm text-grey hover:text-ivory">
              Clear
            </Link>
          )}
        </form>

        <p className="text-sm text-grey">
          {subscribers.total} subscriber{subscribers.total === 1 ? "" : "s"}
          {params.q || params.status ? " match" : ""}.
        </p>

        {subscribers.rows.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-obsidian text-grey">
                <tr>
                  <th scope="col" className="px-4 py-2 text-start font-normal">Email</th>
                  <th scope="col" className="px-4 py-2 text-start font-normal">Status</th>
                  <th scope="col" className="px-4 py-2 text-start font-normal">Stories in</th>
                  <th scope="col" className="px-4 py-2 text-start font-normal">Signed up</th>
                  <th scope="col" className="px-4 py-2 text-end font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subscribers.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-72 truncate px-4 py-2 text-ivory">{row.email}</td>
                    <td className={cn("px-4 py-2", row.status === "ACTIVE" ? "text-gold" : "text-grey")}>{STATUS_LABEL[row.status]}</td>
                    <td className="px-4 py-2 text-grey">{LANGUAGE_LABEL[row.language]}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-grey">{formatDateTime(row.createdAt)}</td>
                    <td className="px-4 py-2 text-end">
                      <RemoveSubscriberButton id={row.id} email={row.email} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {subscribers.pages > 1 && (
          <nav aria-label="Subscriber pages" className="flex items-center justify-between text-sm">
            {params.page > 1 ? (
              <Link href={query({ page: params.page - 1 })} className="text-gold hover:text-gold-soft">
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-grey">
              Page {params.page} of {subscribers.pages}
            </span>
            {params.page < subscribers.pages ? (
              <Link href={query({ page: params.page + 1 })} className="text-gold hover:text-gold-soft">
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </>
  );
}
