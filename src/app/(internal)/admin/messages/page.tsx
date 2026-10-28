import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { MarkReadOnOpen, MessageActions } from "@/components/admin/message-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getMessage, listMessages } from "@/server/contact";

export const metadata: Metadata = { title: "Messages" };

const paramsSchema = z.object({
  filter: z.enum(["all", "unread"]).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  id: z.string().uuid().optional().catch(undefined),
});

export default function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl text-ivory">Messages</h1>
        <p className="text-sm text-grey">Sent through the Contact page. Each one is also emailed to the admin accounts; reply from your email.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full bg-obsidian-raised" />}>
        <Inbox searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Inbox({ searchParams }: { searchParams: PageProps<"/admin/messages">["searchParams"] }) {
  await requireAdmin();
  const params = paramsSchema.parse(await searchParams);
  const [{ rows, total, pages }, selected] = await Promise.all([listMessages(params.filter, params.page), params.id ? getMessage(params.id) : null]);
  const href = (changes: Partial<{ filter: string; page: number; id: string }>) => {
    const merged = { filter: params.filter === "all" ? undefined : params.filter, page: params.page > 1 ? params.page : undefined, id: params.id, ...changes };
    const search = new URLSearchParams(Object.entries(merged).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    return `/admin/messages${search.size ? `?${search}` : ""}`;
  };

  return (
    <>
      <nav aria-label="Filter" className="flex gap-2 text-sm">
        {(["all", "unread"] as const).map((filter) => (
          <Link
            key={filter}
            href={href({ filter: filter === "all" ? undefined : filter, page: undefined, id: undefined })}
            aria-current={params.filter === filter ? "page" : undefined}
            className={cn("rounded-sm border px-3 py-1", params.filter === filter ? "border-gold bg-gold/10 text-gold" : "border-border text-grey hover:text-ivory")}
          >
            {filter === "all" ? "All" : "Unread"}
          </Link>
        ))}
        <span className="self-center text-grey">{total} message{total === 1 ? "" : "s"}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-gold-muted/50 bg-obsidian p-8 text-center text-grey">No messages.</p>
        ) : (
          <ul aria-label="Messages" className="max-h-[70vh] divide-y divide-border overflow-y-auto rounded-md border border-border bg-obsidian">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={href({ id: row.id })}
                  scroll={false}
                  aria-current={row.id === selected?.id ? "true" : undefined}
                  className={cn("block space-y-1 px-4 py-3 transition-colors hover:bg-obsidian-raised/60", row.id === selected?.id && "bg-obsidian-raised")}
                >
                  <span className="flex items-center gap-2">
                    {!row.isRead && (
                      <span className="size-2 shrink-0 rounded-full bg-gold">
                        <span className="sr-only">Unread: </span>
                      </span>
                    )}
                    <span className={cn("truncate text-sm", row.isRead ? "text-grey" : "font-medium text-ivory")} dir="auto">
                      {row.subject}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-grey">
                    {row.name} · {formatDateTime(row.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section aria-label="Message" className="min-w-0">
          {selected ? (
            <article className="space-y-4 rounded-md border border-border bg-obsidian p-5">
              <MarkReadOnOpen id={selected.id} isRead={selected.isRead} />
              <h2 className="text-xl text-ivory" dir="auto">
                {selected.subject}
              </h2>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                <dt className="text-grey">From</dt>
                <dd className="text-ivory" dir="auto">
                  {selected.name}
                </dd>
                <dt className="text-grey">Email</dt>
                <dd>
                  <a href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`} className="text-gold hover:text-gold-soft">
                    {selected.email}
                  </a>
                </dd>
                <dt className="text-grey">Sent</dt>
                <dd className="text-ivory">
                  {formatDateTime(selected.createdAt)} · {selected.locale === "ur" ? "Urdu site" : "English site"}
                </dd>
              </dl>
              {/* Plain text: React escapes it; line breaks kept with whitespace-pre-wrap. */}
              <p className="border-t border-border pt-4 whitespace-pre-wrap text-ivory" dir="auto">
                {selected.message}
              </p>
              <MessageActions id={selected.id} isRead={selected.isRead} />
            </article>
          ) : (
            <p className="text-sm text-grey">Choose a message to read it.</p>
          )}
        </section>
      </div>

      {pages > 1 && (
        <nav aria-label="Message pages" className="flex justify-between text-sm">
          {params.page > 1 ? <Link href={href({ page: params.page - 1, id: undefined })} className="text-gold">Previous</Link> : <span />}
          <span className="text-grey">
            Page {params.page} of {pages}
          </span>
          {params.page < pages ? <Link href={href({ page: params.page + 1, id: undefined })} className="text-gold">Next</Link> : <span />}
        </nav>
      )}
    </>
  );
}
