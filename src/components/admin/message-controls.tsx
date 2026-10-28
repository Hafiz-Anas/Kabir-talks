"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

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
import { deleteMessage, setMessageRead } from "@/server/contact-actions";

/** Opening an unread message marks it read (once), then refreshes the list and the sidebar badge. */
export function MarkReadOnOpen({ id, isRead }: { id: string; isRead: boolean }) {
  const router = useRouter();
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (isRead || done.current === id) return;
    done.current = id;
    setMessageRead(id, true).then(() => router.refresh());
  }, [id, isRead, router]);
  return null;
}

export function MessageActions({ id, isRead }: { id: string; isRead: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="bg-transparent"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setMessageRead(id, !isRead);
            if (!result.ok) setError(result.error);
            router.refresh();
          })
        }
      >
        {isRead ? "Mark as unread" : "Mark as read"}
      </Button>
      <Button type="button" variant="outline" size="sm" className="bg-transparent text-destructive hover:text-destructive" disabled={pending} onClick={() => setConfirm(true)}>
        Delete
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="border-border bg-obsidian">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ivory">Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>It is removed from the inbox for good. The copy sent to your email stays there.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent">Cancel</AlertDialogCancel>
            <Button
              type="button"
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteMessage(id);
                  setConfirm(false);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  router.replace("/admin/messages");
                  router.refresh();
                })
              }
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
