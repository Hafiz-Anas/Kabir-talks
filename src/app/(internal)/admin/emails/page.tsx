import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { emailDriver, emailTestMode } from "@/lib/features";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getOutboxEmail, listOutbox, OUTBOX_PAGE_SIZE } from "@/server/email/outbox";

export const metadata: Metadata = { title: "Email outbox" };

const paramsSchema = z.object({ id: z.string().uuid().optional().catch(undefined) });

export default function EmailOutboxPage({ searchParams }: PageProps<"/admin/emails">) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl text-ivory">Email outbox</h1>
        <p className="text-sm text-grey">The last {OUTBOX_PAGE_SIZE} emails the site sent, newest first.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full bg-obsidian-raised" />}>
        <Outbox searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Outbox({ searchParams }: { searchParams: PageProps<"/admin/emails">["searchParams"] }) {
  await requireAdmin();
  const { id } = paramsSchema.parse(await searchParams);
  const [rows, selected] = await Promise.all([listOutbox(), id ? getOutboxEmail(id) : null]);

  return (
    <>
      <DriverNotice />
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-gold-muted/50 bg-obsidian p-8 text-center text-grey">No emails yet.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ul aria-label="Emails" className="max-h-[70vh] divide-y divide-border overflow-y-auto rounded-md border border-border bg-obsidian">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/emails?id=${row.id}`}
                  scroll={false}
                  aria-current={row.id === selected?.id ? "true" : undefined}
                  className={cn(
                    "block space-y-1 px-4 py-3 transition-colors hover:bg-obsidian-raised/60",
                    row.id === selected?.id && "bg-obsidian-raised",
                  )}
                >
                  <span className="block truncate text-sm text-ivory" dir="auto">
                    {row.subject}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-grey">
                    <span className="truncate">{row.to}</span>
                    <span aria-hidden>·</span>
                    <span>{row.kind}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDateTime(row.createdAt)}</span>
                    {row.status === "failed" && <span className="text-destructive">Failed</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <section aria-label="Preview" className="min-w-0 space-y-3">
            {selected ? <Preview email={selected} /> : <p className="text-sm text-grey">Choose an email to preview it.</p>}
          </section>
        </div>
      )}
    </>
  );
}

function DriverNotice() {
  if (emailDriver === "resend") {
    return (
      <p className="rounded-md border border-border bg-obsidian px-4 py-3 text-sm text-grey">
        Sending through <span className="text-ivory">Resend</span>. Only the recipient, subject and status are kept here, not the message itself.
      </p>
    );
  }
  return (
    <p className="rounded-md border border-gold-muted/50 bg-obsidian px-4 py-3 text-sm text-grey">
      <span className="text-gold">Test mode: no emails leave the server.</span> Each one is written to the server log and kept here instead.{" "}
      {emailTestMode
        ? "EMAIL_TEST_MODE is on, so account emails and the newsletter behave as if they were really sent."
        : "Account emails and the newsletter stay switched off until RESEND_API_KEY and EMAIL_FROM are set."}
    </p>
  );
}

function Preview({ email }: { email: NonNullable<Awaited<ReturnType<typeof getOutboxEmail>>> }) {
  return (
    <>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-md border border-border bg-obsidian p-4 text-sm">
        <dt className="text-grey">To</dt>
        <dd className="truncate text-ivory">{email.to}</dd>
        <dt className="text-grey">Subject</dt>
        <dd className="text-ivory" dir="auto">
          {email.subject}
        </dd>
        <dt className="text-grey">Sent</dt>
        <dd className="text-ivory">
          {formatDateTime(email.createdAt)} · {email.provider} · {email.status}
        </dd>
        {email.error && (
          <>
            <dt className="text-grey">Error</dt>
            <dd className="text-destructive">{email.error}</dd>
          </>
        )}
      </dl>
      {email.html ? (
        <>
          {/* sandbox="" : no scripts, no same-origin access, no navigation. */}
          <iframe
            title={`Preview: ${email.subject}`}
            sandbox=""
            srcDoc={email.html}
            className="h-[70vh] w-full rounded-md border border-border bg-black"
          />
          {email.text && (
            <details className="rounded-md border border-border bg-obsidian p-4 text-sm">
              <summary className="cursor-pointer text-grey hover:text-ivory">Plain-text version</summary>
              <pre className="mt-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap text-ivory" dir="auto">
                {email.text}
              </pre>
            </details>
          )}
        </>
      ) : (
        <p className="text-sm text-grey">The message itself isn’t stored for emails sent through Resend.</p>
      )}
    </>
  );
}
