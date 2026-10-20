"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ArticleStatus, ChecklistItem } from "@/lib/articles/rules";
import { archiveArticle, deleteArticle, publishArticle, unpublishArticle } from "@/server/article-actions";

import { copyText } from "./copy-button";
import { PublishBlockedDialog } from "./publish-dialogs";
import { useShowPublished } from "./publish-success-provider";

export function ArticleRowActions({
  id,
  title,
  status,
  publicUrl,
}: {
  id: string;
  title: string;
  status: ArticleStatus;
  /** Public URL of the first complete language; null if none. */
  publicUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const showPublished = useShowPublished();
  const [missing, setMissing] = useState<ChecklistItem[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setMessage(null);
      const result = await action();
      if (!result.ok) setMessage(result.error ?? "Something went wrong.");
      router.refresh();
    });

  const publish = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await publishArticle({ id });
      if (result.ok) showPublished(result.info, { editHref: `/admin/articles/${id}` });
      else if (result.missing) setMissing(result.missing);
      else setMessage(result.error);
      router.refresh();
    });

  return (
    <div className="flex items-center justify-end gap-2">
      {message && (
        <span role="alert" className="max-w-40 text-xs text-destructive">
          {message}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" disabled={pending} aria-label={`Actions for ${title}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 border-border bg-obsidian">
          <DropdownMenuItem asChild>
            <Link href={`/admin/articles/${id}`}>Edit</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/articles/${id}/preview`}>Preview</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {status === "PUBLISHED" ? (
            <DropdownMenuItem onSelect={() => run(() => unpublishArticle({ id }))}>Unpublish</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={publish}>Publish</DropdownMenuItem>
          )}
          {status === "PUBLISHED" && publicUrl && (
            <DropdownMenuItem
              onSelect={async () => {
                setMessage((await copyText(publicUrl)) ? null : "Couldn't copy");
              }}
            >
              Copy link
            </DropdownMenuItem>
          )}
          {status !== "ARCHIVED" && (
            <DropdownMenuItem onSelect={() => run(() => archiveArticle({ id }))}>Archive</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteArticleDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={title}
        canArchive={status !== "ARCHIVED"}
        pending={pending}
        onArchive={() => {
          setConfirmDelete(false);
          run(() => archiveArticle({ id }));
        }}
        onDelete={() => {
          setConfirmDelete(false);
          run(() => deleteArticle({ id }));
        }}
      />
      <PublishBlockedDialog missing={missing} onOpenChange={() => setMissing(null)} editHref={`/admin/articles/${id}`} />
    </div>
  );
}

/** Delete confirmation that steers towards the safer Archive option. */
export function DeleteArticleDialog({
  open,
  onOpenChange,
  title,
  canArchive,
  pending,
  onArchive,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  canArchive: boolean;
  pending?: boolean;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-border bg-obsidian">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-ivory">Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Deleting is permanent: the article, its tags, comments and stats are removed and can’t be recovered.
            {canArchive && " Archiving hides it from the site but keeps everything, so you can bring it back later."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-wrap gap-2">
          <AlertDialogCancel className="bg-transparent">Cancel</AlertDialogCancel>
          {canArchive && (
            <Button onClick={onArchive} disabled={pending} className="hover:bg-gold-soft">
              Archive instead (recommended)
            </Button>
          )}
          <Button variant="destructive" onClick={onDelete} disabled={pending}>
            Delete permanently
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
