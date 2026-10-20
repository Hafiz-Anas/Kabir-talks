"use client";

import { CheckCircle2, Circle, PartyPopper } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ChecklistItem } from "@/lib/articles/rules";
import { type ShareNetwork, shareUrl } from "@/lib/urls";
import type { PublishedInfo } from "@/server/article-actions";

import { CopyButton } from "./copy-button";

const NETWORKS: { id: ShareNetwork; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "facebook", label: "Facebook" },
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "telegram", label: "Telegram" },
];

const LOCALE_LABEL = { en: "English", ur: "اردو" } as const;

export function PublishSuccessDialog({
  info,
  onOpenChange,
  editHref,
}: {
  info: PublishedInfo | null;
  onOpenChange: (open: boolean) => void;
  /** Omit when already in the editor ("Edit again" just closes the dialog). */
  editHref?: string;
}) {
  const primary = info?.links[0];
  const domain = primary ? new URL(primary.url).host : "";

  return (
    <Dialog open={Boolean(info)} onOpenChange={onOpenChange}>
      {/* minmax(0,1fr): lets the long URLs truncate instead of widening the grid past the dialog. */}
      <DialogContent className="max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto border-border bg-obsidian sm:max-w-xl">
        {info && primary && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl text-ivory">
                <PartyPopper aria-hidden className="size-6 text-gold" />
                Published!
              </DialogTitle>
              <DialogDescription>
                Share it now. Note: public article pages arrive in Phase 4, so these links may show a 404 until then.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {info.links.map((link) => (
                <div key={link.locale} className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-xs tracking-wide text-grey uppercase">
                    <span className={link.locale === "ur" ? "font-urdu normal-case" : undefined}>
                      {LOCALE_LABEL[link.locale]}
                    </span>{" "}
                    link
                  </p>
                  <div className="flex items-center gap-2">
                    <code dir="ltr" className="min-w-0 flex-1 truncate rounded-sm bg-black px-2 py-1.5 text-xs text-ivory">
                      {link.url}
                    </code>
                    <CopyButton text={link.url} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {NETWORKS.map((network) => (
                      <Button key={network.id} asChild variant="outline" size="xs" className="bg-transparent">
                        <a href={shareUrl(network.id, link.url, link.title)} target="_blank" rel="noopener noreferrer">
                          {network.label}
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="space-y-2">
                <p className="text-xs tracking-wide text-grey uppercase">Link preview (approximate)</p>
                <div className="overflow-hidden rounded-md border border-border bg-black">
                  {info.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- mockup of a third-party share card
                    <img src={info.coverImageUrl} alt={info.coverImageAlt ?? ""} className="aspect-[1.91/1] w-full object-cover" />
                  ) : (
                    <div className="grid aspect-[1.91/1] place-items-center bg-obsidian-raised font-serif text-4xl text-gold">KT</div>
                  )}
                  <div
                    className="space-y-1 p-3"
                    dir={primary.locale === "ur" ? "rtl" : "ltr"}
                    lang={primary.locale}
                  >
                    <p dir="ltr" className="text-xs text-grey uppercase">
                      {domain}
                    </p>
                    <p className="line-clamp-2 font-semibold text-ivory">{info.title}</p>
                    {info.excerpt && <p className="line-clamp-2 text-sm text-grey">{info.excerpt}</p>}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-wrap gap-2 sm:justify-start">
              <Button asChild className="hover:bg-gold-soft">
                <a href={primary.url} target="_blank" rel="noopener">
                  View article
                </a>
              </Button>
              {editHref ? (
                <Button asChild variant="outline" className="bg-transparent">
                  <Link href={editHref}>Edit again</Link>
                </Button>
              ) : (
                <Button variant="outline" className="bg-transparent" onClick={() => onOpenChange(false)}>
                  Edit again
                </Button>
              )}
              <Button asChild variant="ghost">
                <Link href="/admin/articles/new">Write another</Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-2">
          {item.done ? (
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          ) : (
            <Circle aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          <span className={item.done ? "text-grey" : "text-ivory"}>
            {item.label}
            <span className="sr-only">{item.done ? " (done)" : " (missing)"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PublishBlockedDialog({
  missing,
  onOpenChange,
  editHref,
}: {
  missing: ChecklistItem[] | null;
  onOpenChange: (open: boolean) => void;
  editHref?: string;
}) {
  return (
    <Dialog open={Boolean(missing)} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-obsidian">
        <DialogHeader>
          <DialogTitle className="text-ivory">Not ready to publish</DialogTitle>
          <DialogDescription>Complete these items, then publish again.</DialogDescription>
        </DialogHeader>
        {missing && <Checklist items={missing} />}
        <DialogFooter>
          {editHref && (
            <Button asChild className="hover:bg-gold-soft">
              <Link href={editHref}>Open in editor</Link>
            </Button>
          )}
          <Button variant="outline" className="bg-transparent" onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
