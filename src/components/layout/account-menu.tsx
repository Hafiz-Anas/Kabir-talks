"use client";

import { Bookmark, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Avatar } from "@/components/account/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Dictionary, Locale } from "@/i18n";
import { signOut, useSession } from "@/lib/auth-client";
import { loginPath } from "@/lib/urls";
import { cn } from "@/lib/utils";

/**
 * Signed-in state for the public header. The session is read in the browser
 * (GET /api/auth/get-session) so every public page stays static and no
 * reader's data ever ends up in cached HTML. While it loads, a same-size
 * placeholder keeps the header from jumping.
 */

export type AccountLabels = Pick<
  Dictionary["nav"],
  "signIn" | "accountMenu" | "signedInAs" | "myBookmarks" | "myAccount" | "adminDashboard" | "signOut"
>;

export function AccountMenu({ locale, labels }: { locale: Locale; labels: AccountLabels }) {
  const { data, isPending } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  if (isPending) return <span aria-hidden className="size-9 shrink-0 rounded-full bg-obsidian-raised/60" />;

  if (!data) {
    return (
      <Link
        href={loginPath(locale, pathname)}
        className="hidden h-8 shrink-0 items-center rounded-sm border border-gold-muted px-3 text-sm text-ivory transition-colors hover:border-gold hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none min-[400px]:inline-flex"
      >
        {labels.signIn}
      </Link>
    );
  }

  const { user } = data;
  const itemClass = "gap-2.5 py-2 text-sm";

  return (
    <DropdownMenu dir={locale === "ur" ? "rtl" : "ltr"}>
      <DropdownMenuTrigger
        aria-label={labels.accountMenu}
        className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none"
      >
        <Avatar name={user.name} image={user.image} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60 border-border bg-obsidian">
        <DropdownMenuLabel className="space-y-0.5 font-normal">
          <span className="block text-xs text-grey">{labels.signedInAs}</span>
          <span dir="auto" className="block truncate text-sm text-ivory">
            {user.name}
          </span>
          <span dir="ltr" className="block truncate text-xs text-grey">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className={itemClass}>
          <Link href={`/${locale}/account/bookmarks`}>
            <Bookmark aria-hidden />
            {labels.myBookmarks}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={itemClass}>
          <Link href={`/${locale}/account`}>
            <UserRound aria-hidden />
            {labels.myAccount}
          </Link>
        </DropdownMenuItem>
        {user.role === "admin" && (
          <DropdownMenuItem asChild className={itemClass}>
            {/* Another root layout: Next does a full page load for this link. */}
            <Link href="/admin">
              <LayoutDashboard aria-hidden />
              {labels.adminDashboard}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={itemClass}
          onSelect={async () => {
            await signOut();
            // Private pages (account, bookmarks) must not stay on screen after signing out.
            if (pathname.includes("/account")) router.replace(`/${locale}`);
            router.refresh();
          }}
        >
          <LogOut aria-hidden />
          {labels.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Mobile menu version: plain links instead of a dropdown. */
export function AccountLinks({
  locale,
  labels,
  linkClass,
}: {
  locale: Locale;
  labels: AccountLabels & { signUp: string };
  linkClass: string;
}) {
  const { data, isPending } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  if (isPending) return <div aria-hidden className="h-11" />;

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={loginPath(locale, pathname)}
          className="flex h-11 items-center justify-center rounded-sm border border-gold-muted text-sm text-ivory transition-colors hover:border-gold hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {labels.signIn}
        </Link>
        <Link
          href={loginPath(locale, pathname, "signup")}
          className="flex h-11 items-center justify-center rounded-sm bg-gold text-sm text-black transition-colors hover:bg-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {labels.signUp}
        </Link>
      </div>
    );
  }

  const { user } = data;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 py-2">
        <Avatar name={user.name} image={user.image} />
        <div className="min-w-0">
          <p className="text-xs text-grey">{labels.signedInAs}</p>
          <p dir="auto" className="truncate text-ivory">
            {user.name}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-border">
        <li>
          <Link href={`/${locale}/account/bookmarks`} className={linkClass}>
            {labels.myBookmarks}
          </Link>
        </li>
        <li>
          <Link href={`/${locale}/account`} className={linkClass}>
            {labels.myAccount}
          </Link>
        </li>
        {user.role === "admin" && (
          <li>
            <Link href="/admin" className={linkClass}>
              {labels.adminDashboard}
            </Link>
          </li>
        )}
        <li>
          <button
            type="button"
            className={cn(linkClass, "w-full text-start")}
            onClick={async () => {
              await signOut();
              if (pathname.includes("/account")) router.replace(`/${locale}`);
              router.refresh();
            }}
          >
            {labels.signOut}
          </button>
        </li>
      </ul>
    </div>
  );
}
