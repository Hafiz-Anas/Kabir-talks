"use client";

import { Ban, Check, CornerDownRight, ExternalLink, MessageSquareReply, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { COMMENT_MAX, commentLength } from "@/lib/comments";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  approveComments,
  deleteCommentAsAdmin,
  type ModerationResult,
  rejectComments,
  replyAsAdmin,
  setReaderCommentingBlocked,
} from "@/server/comment-actions";

export type ModerationItem = {
  id: string;
  body: string;
  createdAt: string;
  edited: boolean;
  isReply: boolean;
  parentExcerpt: string | null;
  author: { id: string; name: string; email: string; isAdmin: boolean; blocked: boolean } | null;
  article: { title: string; urdu: boolean; href: string; published: boolean };
};

const ERRORS: Record<string, string> = {
  empty: "Write a reply first.",
  too_long: `Replies can be up to ${COMMENT_MAX} characters.`,
  not_found: "That comment no longer exists.",
};

/**
 * The moderation queue: select comments for bulk approve/reject, or act on
 * one (approve, reject, delete, reply as admin, block/unblock the author).
 * Comment text is shown as plain text, exactly as the reader typed it.
 */
export function ModerationList({ status, items }: { status: "PENDING" | "APPROVED" | "REJECTED"; items: ModerationItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = (action: () => Promise<ModerationResult>, done?: string) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? (done ?? null) : (ERRORS[result.error] ?? "Something went wrong. Please try again."));
      if (result.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });

  const allSelected = items.length > 0 && selected.size === items.length;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-3 rounded-md border border-border bg-obsidian/95 px-4 py-2.5 backdrop-blur">
        <label className="flex items-center gap-2 text-sm text-grey">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)))}
            className="size-4 accent-[var(--color-gold)]"
          />
          {selected.size ? `${selected.size} selected` : "Select all"}
        </label>
        <div className="ms-auto flex gap-2">
          {status !== "APPROVED" && (
            <Button
              size="sm"
              disabled={!selected.size || pending}
              onClick={() => run(() => approveComments([...selected]), `Approved ${selected.size}.`)}
              className="hover:bg-gold-soft"
            >
              <Check aria-hidden /> Approve selected
            </Button>
          )}
          {status !== "REJECTED" && (
            <Button
              size="sm"
              variant="outline"
              className="bg-transparent"
              disabled={!selected.size || pending}
              onClick={() => run(() => rejectComments([...selected]), `Rejected ${selected.size}.`)}
            >
              <X aria-hidden /> Reject selected
            </Button>
          )}
        </div>
      </div>
      <p role="status" className="min-h-5 text-sm text-gold-soft">
        {message}
      </p>

      <ul className="space-y-3">
        {items.map((item) => (
          <ModerationRow
            key={item.id}
            item={item}
            status={status}
            selected={selected.has(item.id)}
            onToggle={() => toggle(item.id)}
            busy={pending}
            run={run}
          />
        ))}
      </ul>
    </div>
  );
}

function ModerationRow({
  item,
  status,
  selected,
  onToggle,
  busy,
  run,
}: {
  item: ModerationItem;
  status: "PENDING" | "APPROVED" | "REJECTED";
  selected: boolean;
  onToggle: () => void;
  busy: boolean;
  run: (action: () => Promise<ModerationResult>, done?: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reply, setReply] = useState("");
  const length = commentLength(reply);

  return (
    <li className={cn("rounded-md border bg-obsidian p-4", selected ? "border-gold-muted" : "border-border")}>
      <div className="flex gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select comment by ${item.author?.name ?? "deleted user"}`}
          className="mt-1 size-4 shrink-0 accent-[var(--color-gold)]"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {item.author ? (
              <>
                <span dir="auto" className="font-medium text-ivory">
                  {item.author.name}
                </span>
                <span className="text-grey">{item.author.email}</span>
                {item.author.isAdmin && <span className="rounded-sm border border-gold-muted px-1.5 text-xs text-gold">Admin</span>}
                {item.author.blocked && (
                  <span className="rounded-sm border border-destructive/50 px-1.5 text-xs text-red-300">Blocked from commenting</span>
                )}
              </>
            ) : (
              <span className="text-grey italic">Deleted user</span>
            )}
            <span className="text-xs text-grey">{formatDateTime(item.createdAt)}</span>
            {item.edited && <span className="text-xs text-grey-dim">edited</span>}
          </div>

          <p className="text-xs text-grey">
            On{" "}
            <a
              href={item.article.href}
              target="_blank"
              rel="noopener"
              lang={item.article.urdu ? "ur" : undefined}
              className="inline-flex items-center gap-1 text-gold hover:text-gold-soft"
            >
              {item.article.title}
              <ExternalLink aria-hidden className="size-3" />
            </a>
            {!item.article.published && " (not published)"}
          </p>
          {item.isReply && (
            <p className="flex items-start gap-1.5 text-xs text-grey">
              <CornerDownRight aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Reply to: <span dir="auto" className="text-grey-dim">“{item.parentExcerpt || "deleted comment"}”</span>
              </span>
            </p>
          )}

          <p dir="auto" className="rounded-sm bg-black/30 px-3 py-2 text-[0.9375rem] break-words whitespace-pre-wrap text-ivory [unicode-bidi:plaintext]">
            {item.body}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {status !== "APPROVED" && (
              <Button size="sm" variant="outline" className="bg-transparent" disabled={busy} onClick={() => run(() => approveComments([item.id]), "Approved.")}>
                <Check aria-hidden /> Approve
              </Button>
            )}
            {status !== "REJECTED" && (
              <Button size="sm" variant="outline" className="bg-transparent" disabled={busy} onClick={() => run(() => rejectComments([item.id]), "Rejected.")}>
                <X aria-hidden /> Reject
              </Button>
            )}
            <Button size="sm" variant="outline" className="bg-transparent" disabled={busy} onClick={() => setReplying((v) => !v)}>
              <MessageSquareReply aria-hidden /> Reply
            </Button>
            {item.author && !item.author.isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  run(
                    () => setReaderCommentingBlocked(item.author!.id, !item.author!.blocked),
                    item.author!.blocked ? `${item.author!.name} can comment again.` : `${item.author!.name} is blocked from commenting.`,
                  )
                }
              >
                <Ban aria-hidden /> {item.author.blocked ? "Unblock author" : "Block author"}
              </Button>
            )}
            {confirmDelete ? (
              <span className="flex items-center gap-2">
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => run(() => deleteCommentAsAdmin(item.id), "Deleted.")}>
                  Delete permanently
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" className="text-red-300 hover:text-red-200" disabled={busy} onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden /> Delete
              </Button>
            )}
          </div>

          {replying && (
            <form
              className="space-y-2 pt-2"
              onSubmit={(event) => {
                event.preventDefault();
                run(async () => {
                  const result = await replyAsAdmin(item.id, reply);
                  if (result.ok) {
                    setReply("");
                    setReplying(false);
                  }
                  return result;
                }, "Reply published.");
              }}
            >
              <label htmlFor={`reply-${item.id}`} className="text-xs text-grey">
                Reply as Kabir Talks (published straight away{status === "PENDING" ? "; this also approves the comment" : ""})
              </label>
              <textarea
                id={`reply-${item.id}`}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                dir="auto"
                rows={3}
                className="w-full rounded-md border border-input bg-black/30 px-3 py-2 text-sm text-ivory focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [unicode-bidi:plaintext]"
              />
              <div className="flex items-center justify-between gap-3">
                <span className={cn("text-xs", length > COMMENT_MAX ? "text-destructive" : "text-grey")}>
                  {length}/{COMMENT_MAX}
                </span>
                <Button size="sm" type="submit" disabled={busy || length === 0 || length > COMMENT_MAX} className="hover:bg-gold-soft">
                  Publish reply
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
