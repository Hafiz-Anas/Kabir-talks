"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Dictionary, Locale } from "@/i18n";
import { loginPath } from "@/lib/urls";
import { cn } from "@/lib/utils";

import { toggleBookmark, useBookmark } from "./bookmark-store";

type Labels = Dictionary["bookmarks"];

/**
 * Save / unsave an article. `icon` sits on article cards, `tool` in the
 * article's reader toolbar. Signed out → a small prompt to sign in or sign
 * up, which returns to the current page afterwards.
 */
export function BookmarkButton({
  articleId,
  locale,
  labels,
  variant,
  className,
}: {
  articleId: string;
  locale: Locale;
  labels: Labels;
  variant: "icon" | "tool";
  className?: string;
}) {
  const { saved } = useBookmark(articleId);
  const [prompt, setPrompt] = useState(false);
  const [error, setError] = useState(false);
  const Icon = saved ? BookmarkCheck : Bookmark;

  async function onClick() {
    setError(false);
    const result = await toggleBookmark(articleId);
    if (result === "signed-out") setPrompt(true);
    if (result === "error") setError(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={variant === "icon" ? (saved ? labels.remove : labels.add) : undefined}
        title={variant === "icon" ? (saved ? labels.remove : labels.add) : undefined}
        className={cn(
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          variant === "icon"
            ? "relative z-10 grid size-9 place-items-center rounded-full bg-black/65 text-ivory backdrop-blur transition-colors hover:text-gold-soft"
            : "inline-flex h-9 items-center gap-2 rounded-sm border border-border px-3 text-sm text-ivory transition-colors hover:border-gold-muted hover:text-gold-soft",
          saved && "text-gold",
          className,
        )}
      >
        <Icon aria-hidden className={cn("size-4", saved && "fill-gold/25")} />
        {variant === "tool" && <span>{saved ? labels.saved : labels.save}</span>}
      </button>
      <span role="status" className={variant === "tool" && error ? "text-xs text-destructive" : "sr-only"}>
        {error ? labels.error : ""}
      </span>
      {prompt && <SignInPrompt open={prompt} onOpenChange={setPrompt} locale={locale} labels={labels} />}
    </>
  );
}

function SignInPrompt({
  open,
  onOpenChange,
  locale,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  labels: Labels;
}) {
  const pathname = usePathname();
  const linkClass =
    "flex h-10 flex-1 items-center justify-center rounded-sm text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={locale === "ur" ? "rtl" : "ltr"} closeLabel={labels.close} className="max-w-sm border-border bg-obsidian">
        <DialogTitle className="text-xl text-ivory">{labels.promptTitle}</DialogTitle>
        <DialogDescription className="text-grey">{labels.promptBody}</DialogDescription>
        <div className="flex gap-3 pt-2">
          <Link href={loginPath(locale, pathname)} className={cn(linkClass, "border border-gold-muted text-ivory hover:border-gold")}>
            {labels.signIn}
          </Link>
          <Link href={loginPath(locale, pathname, "signup")} className={cn(linkClass, "bg-gold text-black hover:bg-gold-soft")}>
            {labels.signUp}
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
