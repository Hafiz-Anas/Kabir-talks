import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n";
import { pageMetadata } from "@/lib/seo";

/** Narrow card used by the sign-in, sign-up and password pages. */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <div className="rounded-md border border-border bg-obsidian p-6 sm:p-8">{children}</div>
    </div>
  );
}

/** Shown while a form that reads ?next= / ?token= from the URL hydrates. */
export function AuthFormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <Skeleton className="h-7 w-40 bg-obsidian-raised" />
      <Skeleton className="h-9 w-full bg-obsidian-raised" />
      <Skeleton className="h-9 w-full bg-obsidian-raised" />
      <Skeleton className="h-9 w-full bg-obsidian-raised" />
    </div>
  );
}

/** Auth pages are useful to people, not search engines: noindex, no share image needed. */
export function authMetadata(locale: Locale, page: string, title: string, description: string): Metadata {
  return pageMetadata({ locale, path: `/${locale}/${page}`, title, description, noindex: true });
}
