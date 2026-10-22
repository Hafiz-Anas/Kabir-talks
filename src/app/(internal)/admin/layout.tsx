import { ExternalLink } from "lucide-react";
import { Suspense } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { MobileNav } from "@/components/admin/mobile-nav";
import { PublishSuccessProvider } from "@/components/admin/publish-success-provider";
import { Logo } from "@/components/layout/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { pendingCommentCount } from "@/server/comments";

import { SignOutButton } from "./sign-out-button";

/**
 * Admin shell. Nothing under /admin renders until requireAdmin() passes on
 * the server. Pages and server actions call requireAdmin() again themselves
 * (defence in depth), so a single missed check can't expose data.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  // Sidebar badge; moderation actions revalidate this layout.
  const pendingComments = await pendingCommentCount();

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-8 overflow-y-auto border-e border-border bg-obsidian p-4 md:flex">
        <div className="flex items-center gap-2 px-1 pt-2">
          <Logo href="/admin" />
        </div>
        <AdminNav pendingComments={pendingComments} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-black/90 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <MobileNav pendingComments={pendingComments} />
            <span className="rounded-sm border border-gold-muted px-2 py-0.5 text-xs tracking-wide text-gold uppercase">
              Admin
            </span>
            <div className="ms-auto flex items-center gap-2 sm:gap-4">
              <span className="hidden max-w-56 truncate text-sm text-grey lg:inline">{session.user.email}</span>
              <a
                href="/en"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-sm text-grey transition-colors hover:text-gold-soft"
              >
                <ExternalLink aria-hidden className="size-4" />
                <span className="hidden sm:inline">View site</span>
              </a>
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <PublishSuccessProvider>{children}</PublishSuccessProvider>
        </main>
      </div>
    </div>
  );
}

function AdminLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8" aria-busy>
      <Skeleton className="h-8 w-48 bg-obsidian-raised" />
      <Skeleton className="h-32 w-full bg-obsidian-raised" />
    </div>
  );
}
