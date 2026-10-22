import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CommentStatusBadge } from "@/components/account/comment-status";
import { DeleteAccount } from "@/components/account/delete-account";
import { PasswordForm } from "@/components/account/password-form";
import { ProfileForm } from "@/components/account/profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { type Dictionary, getDictionary, isLocale, type Locale } from "@/i18n";
import { requireUser } from "@/lib/auth-guards";
import { features } from "@/lib/features";
import { formatPublicDate } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { getAccountOverview } from "@/server/account";

/**
 * The reader's own account. Private and dynamic: the content renders per
 * request inside <Suspense> after requireUser() (src/proxy.ts already sends
 * visitors without a session cookie to the sign-in page). noindex.
 */

export async function generateMetadata({ params }: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { account } = getDictionary(locale);
  return pageMetadata({ locale, path: `/${locale}/account`, title: account.title, description: account.description, noindex: true });
}

export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-10 sm:py-12">
      <header className="kt-rule space-y-2 pt-6">
        <h1 className="text-4xl text-ivory">{dict.account.title}</h1>
        <p className="text-grey">{dict.account.description}</p>
      </header>
      <Suspense fallback={<AccountSkeleton />}>
        <AccountContent locale={locale} dict={dict} />
      </Suspense>
    </div>
  );
}

function Section({ id, title, children, danger }: { id: string; title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section
      aria-labelledby={id}
      className={danger ? "space-y-4 rounded-md border border-destructive/40 p-5 sm:p-6" : "space-y-5 rounded-md border border-border bg-obsidian p-5 sm:p-6"}
    >
      <h2 id={id} className="text-xl text-ivory">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function AccountContent({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const session = await requireUser(`/${locale}/account`, locale);
  const data = await getAccountOverview(session.user.id, locale);
  if (!data) notFound();
  const labels = dict.account;

  return (
    <>
      <Section id="profile" title={labels.profile}>
        <ProfileForm initial={data.profile} labels={labels} storageEnabled={features.storageEnabled} />
      </Section>

      <Section id="password" title={labels.password}>
        {data.hasPassword ? (
          <PasswordForm labels={labels} authLabels={dict.auth} />
        ) : (
          <p className="text-sm text-grey">{labels.noPassword}</p>
        )}
        <div className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-medium text-ivory">{labels.connected}</h3>
          <ul className="space-y-1.5 text-sm">
            {data.hasPassword && (
              <li className="flex items-center justify-between gap-3">
                <span>{labels.emailMethod}</span>
                <span className="text-gold-soft">{labels.connectedLabel}</span>
              </li>
            )}
            {data.hasGoogle && (
              <li className="flex items-center justify-between gap-3">
                <span>{labels.googleMethod}</span>
                <span className="text-gold-soft">{labels.connectedLabel}</span>
              </li>
            )}
          </ul>
        </div>
      </Section>

      <Section id="my-comments" title={labels.myComments}>
        {data.comments.length === 0 ? (
          <p className="text-sm text-grey">{labels.noComments}</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.comments.map((comment) => (
              <li key={comment.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-grey">
                  <CommentStatusBadge status={comment.status} label={labels.commentStatus[comment.status]} />
                  <time dateTime={comment.createdAt}>{formatPublicDate(comment.createdAt, locale)}</time>
                  {comment.article ? (
                    <Link
                      href={comment.article.href}
                      lang={comment.article.locale !== locale ? comment.article.locale : undefined}
                      className="min-w-0 truncate text-gold hover:text-gold-soft"
                    >
                      {comment.article.title}
                    </Link>
                  ) : (
                    <span>{labels.articleGone}</span>
                  )}
                </div>
                <p dir="auto" className="line-clamp-3 text-sm whitespace-pre-line text-ivory/90 [unicode-bidi:plaintext]">
                  {comment.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="delete" title={labels.deleteTitle} danger>
        {data.profile.role === "admin" ? (
          <p className="text-sm text-grey">{labels.adminCannotDelete}</p>
        ) : (
          <>
            <p className="max-w-2xl text-sm text-grey">{labels.deleteIntro}</p>
            <DeleteAccount locale={locale} hasPassword={data.hasPassword} labels={labels} authLabels={dict.auth} />
          </>
        )}
      </Section>
    </>
  );
}

function AccountSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <Skeleton className="h-64 w-full bg-obsidian-raised" />
      <Skeleton className="h-48 w-full bg-obsidian-raised" />
    </div>
  );
}
