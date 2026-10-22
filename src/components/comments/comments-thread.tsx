"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";

import { Avatar } from "@/components/account/avatar";
import { Button } from "@/components/ui/button";
import { type Dictionary, fill, type Locale } from "@/i18n";
import { useSession } from "@/lib/auth-client";
import {
  COMMENT_MAX,
  type CommentErrorCode,
  commentLength,
  type ThreadComment,
  type ThreadResponse,
} from "@/lib/comments";
import { formatPublicDate, formatRelative } from "@/lib/format";
import { loginPath } from "@/lib/urls";
import { cn } from "@/lib/utils";

/**
 * The comments section (loaded lazily by ./lazy-comments.tsx). Everything
 * comes from GET /api/comments in the browser; the article page stays static.
 * Comment text is rendered as React text — escaped, never HTML — and links are
 * not turned into anchors. `dir="auto"` + plaintext bidi lets each comment
 * (Urdu, English or mixed) lay out in its own direction.
 */

export type CommentsLabels = Dictionary["comments"] & { signIn: string; signUp: string; adminBadge: string };

type Props = { articleId: string; locale: Locale; labels: CommentsLabels };

function errorText(code: CommentErrorCode | undefined, labels: CommentsLabels) {
  switch (code) {
    case "blocked":
      return labels.blocked;
    case "closed":
      return labels.closed;
    case "rate_limited":
      return labels.rateLimited;
    case "empty":
      return labels.emptyBody;
    case "too_long":
      return fill(labels.tooLong, { max: COMMENT_MAX });
    case "edit_expired":
      return labels.editExpired;
    default:
      return labels.error;
  }
}

async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<CommentErrorCode | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { error?: CommentErrorCode };
    return data.error ?? "invalid";
  } catch {
    return "invalid";
  }
}

async function fetchThread(articleId: string): Promise<ThreadResponse | null> {
  try {
    const res = await fetch(`/api/comments?articleId=${articleId}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as ThreadResponse) : null;
  } catch {
    return null;
  }
}

export default function CommentsThread({ articleId, locale, labels }: Props) {
  const [data, setData] = useState<ThreadResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const session = useSession();
  const userId = session.isPending ? undefined : (session.data?.user.id ?? null);

  const apply = useCallback((result: ThreadResponse | null) => {
    if (result) setData(result);
    setFailed(!result);
  }, []);
  const load = useCallback(async () => apply(await fetchThread(articleId)), [apply, articleId]);

  // Load on mount, and again when the visitor signs in or out.
  useEffect(() => {
    if (userId === undefined) return;
    let cancelled = false;
    fetchThread(articleId).then((result) => !cancelled && apply(result));
    return () => {
      cancelled = true;
    };
  }, [apply, articleId, userId]);

  if (failed && !data) {
    return (
      <div className="space-y-3 rounded-md border border-border bg-obsidian p-5 text-sm">
        <p className="text-grey">{labels.loadError}</p>
        <Button variant="outline" size="sm" className="bg-transparent" onClick={() => void load()}>
          {labels.retry}
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div aria-busy className="space-y-3">
        <p className="text-sm text-grey">{labels.loading}</p>
        <div className="h-24 animate-pulse rounded-md bg-obsidian-raised/60" />
      </div>
    );
  }

  const { viewer } = data;
  const canPost = data.commentsEnabled && viewer.signedIn && !viewer.blocked;
  const ctx = { locale, labels, canReply: canPost, reload: load };

  return (
    <div className="space-y-8">
      <Composer data={data} articleId={articleId} {...ctx} />
      {data.comments.length === 0 ? (
        <p className="text-sm text-grey">{labels.empty}</p>
      ) : (
        <ol className="space-y-6">
          {data.comments.map((comment) => (
            <li key={comment.id}>
              <CommentItem comment={comment} articleId={articleId} {...ctx} />
              {comment.replies.length > 0 && (
                <ol className="ms-5 mt-4 space-y-4 border-s border-border ps-4 sm:ms-12">
                  {comment.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentItem comment={reply} articleId={articleId} {...ctx} canReply={false} />
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

type ItemContext = { locale: Locale; labels: CommentsLabels; canReply: boolean; reload: () => Promise<void> };

function Composer({ data, articleId, locale, labels, reload }: ItemContext & { data: ThreadResponse; articleId: string }) {
  const pathname = usePathname();
  const { viewer } = data;
  const notice = "rounded-md border border-border bg-obsidian p-5 text-sm text-grey";

  if (!data.commentsEnabled) return <p className={notice}>{labels.closed}</p>;
  if (!viewer.signedIn) {
    const back = `${pathname}#comments`;
    return (
      <div className={cn(notice, "flex flex-wrap items-center justify-between gap-4")}>
        <p className="text-ivory">{labels.signInPrompt}</p>
        <div className="flex gap-2">
          <Link
            href={loginPath(locale, back)}
            className="inline-flex h-9 items-center rounded-sm border border-gold-muted px-4 text-sm text-ivory hover:border-gold hover:text-gold-soft"
          >
            {labels.signIn}
          </Link>
          <Link
            href={loginPath(locale, back, "signup")}
            className="inline-flex h-9 items-center rounded-sm bg-gold px-4 text-sm text-black hover:bg-gold-soft"
          >
            {labels.signUp}
          </Link>
        </div>
      </div>
    );
  }
  if (viewer.blocked) return <p className={notice}>{labels.blocked}</p>;

  return (
    <div className="flex gap-3">
      <Avatar name={viewer.name} image={viewer.image} className="hidden sm:grid" />
      <CommentForm
        className="flex-1"
        labels={labels}
        label={labels.label}
        placeholder={labels.placeholder}
        submitLabel={labels.submit}
        note={labels.moderationNote}
        onSubmit={async (body) => {
          const error = await send("/api/comments", "POST", { articleId, body });
          if (!error) await reload();
          return error;
        }}
      />
    </div>
  );
}

function CommentForm({
  labels,
  label,
  placeholder,
  submitLabel,
  note,
  initial = "",
  autoFocus,
  onSubmit,
  onCancel,
  className,
}: {
  labels: CommentsLabels;
  label: string;
  placeholder: string;
  submitLabel: string;
  note?: string;
  initial?: string;
  autoFocus?: boolean;
  /** Resolves with an error code, or null on success (the form then clears). */
  onSubmit: (body: string) => Promise<CommentErrorCode | null>;
  onCancel?: () => void;
  className?: string;
}) {
  const id = useId();
  const [body, setBody] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const length = commentLength(body);
  const remaining = COMMENT_MAX - length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (length === 0) return setError(labels.emptyBody);
    if (remaining < 0) return setError(fill(labels.tooLong, { max: COMMENT_MAX }));
    setPending(true);
    setError(null);
    const code = await onSubmit(body);
    setPending(false);
    if (code) setError(errorText(code, labels));
    else setBody("");
  }

  return (
    <form onSubmit={submit} className={cn("space-y-2", className)}>
      <label htmlFor={`${id}-body`} className="sr-only">
        {label}
      </label>
      <textarea
        id={`${id}-body`}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          setError(null);
        }}
        placeholder={placeholder}
        dir="auto"
        rows={3}
        autoFocus={autoFocus}
        aria-describedby={`${id}-count${note ? ` ${id}-note` : ""}`}
        aria-invalid={remaining < 0 || undefined}
        className="w-full resize-y rounded-md border border-input bg-obsidian px-3 py-2 text-base text-ivory placeholder:text-grey-dim focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none [unicode-bidi:plaintext]"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="space-y-1 text-xs">
          <p id={`${id}-count`} aria-live="polite" className={remaining < 0 ? "text-destructive" : "text-grey"}>
            {fill(labels.remaining, { count: remaining })}
          </p>
          {note && (
            <p id={`${id}-note`} className="text-grey-dim">
              {note}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {labels.cancel}
            </Button>
          )}
          <Button type="submit" size="sm" className="hover:bg-gold-soft" disabled={pending || length === 0 || remaining < 0}>
            {pending ? labels.posting : submitLabel}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function CommentItem({ comment, articleId, locale, labels, canReply, reload }: ItemContext & { comment: ThreadComment; articleId: string }) {
  const [mode, setMode] = useState<"view" | "reply" | "edit" | "confirm-delete">("view");
  const [error, setError] = useState<string | null>(null);

  if (comment.deleted) {
    return <p className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-grey-dim italic">{labels.deleted}</p>;
  }

  const author = comment.author;
  const name = author?.isYou ? labels.you : (author?.name ?? labels.deletedUser);
  const actionClass = "text-xs text-grey transition-colors hover:text-gold-soft focus-visible:underline focus-visible:outline-none";

  return (
    <article className="flex gap-3" aria-label={name}>
      <Avatar name={author?.name ?? null} image={author?.image} size="sm" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span dir="auto" className={cn("font-medium", author?.name ? "text-ivory" : "text-grey italic")}>
            {name}
          </span>
          {author?.isAdmin && (
            <span className="rounded-sm border border-gold-muted px-1.5 py-px text-[0.6875rem] tracking-wide text-gold">
              {labels.adminBadge}
            </span>
          )}
          <time dateTime={comment.createdAt} title={formatPublicDate(comment.createdAt, locale)} className="text-xs text-grey">
            {formatRelative(comment.createdAt, locale)}
          </time>
          {comment.editedAt && <span className="text-xs text-grey-dim">· {labels.edited}</span>}
          {comment.status === "PENDING" && (
            <span className="rounded-sm border border-gold-muted/60 bg-gold/10 px-1.5 py-px text-[0.6875rem] text-gold">
              {labels.pending}
            </span>
          )}
        </header>

        {mode === "edit" ? (
          <CommentForm
            labels={labels}
            label={labels.label}
            placeholder={labels.placeholder}
            submitLabel={labels.save}
            note={author?.isAdmin ? undefined : labels.editRecheck}
            initial={comment.body ?? ""}
            autoFocus
            onCancel={() => setMode("view")}
            onSubmit={async (body) => {
              const code = await send(`/api/comments/${comment.id}`, "PATCH", { body });
              if (!code) {
                setMode("view");
                await reload();
              }
              return code;
            }}
          />
        ) : (
          <p dir="auto" className="text-[0.9375rem] break-words whitespace-pre-wrap text-ivory/90 [unicode-bidi:plaintext]">
            {comment.body}
          </p>
        )}
        {comment.status === "PENDING" && mode !== "edit" && <p className="text-xs text-grey-dim">{labels.pendingNote}</p>}

        {mode === "confirm-delete" ? (
          <div className="flex flex-wrap items-center gap-3 text-sm" role="group">
            <span className="text-ivory">{labels.deleteConfirm}</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                const code = await send(`/api/comments/${comment.id}`, "DELETE");
                if (code) setError(errorText(code, labels));
                else await reload();
                setMode("view");
              }}
            >
              {labels.delete}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
              {labels.cancel}
            </Button>
          </div>
        ) : (
          mode === "view" && (
            <div className="flex flex-wrap gap-4">
              {canReply && !comment.parentId && comment.status === "APPROVED" && (
                <button type="button" className={actionClass} onClick={() => setMode("reply")}>
                  {labels.reply}
                </button>
              )}
              {comment.canEdit && (
                <button type="button" className={actionClass} onClick={() => setMode("edit")}>
                  {labels.edit}
                </button>
              )}
              {comment.canDelete && (
                <button type="button" className={actionClass} onClick={() => setMode("confirm-delete")}>
                  {labels.delete}
                </button>
              )}
            </div>
          )
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {mode === "reply" && (
          <CommentForm
            className="pt-2"
            labels={labels}
            label={fill(labels.replyTo, { name })}
            placeholder={labels.replyPlaceholder}
            submitLabel={labels.submitReply}
            note={labels.moderationNote}
            autoFocus
            onCancel={() => setMode("view")}
            onSubmit={async (body) => {
              const code = await send("/api/comments", "POST", { articleId, parentId: comment.id, body });
              if (!code) {
                setMode("view");
                await reload();
              }
              return code;
            }}
          />
        )}
      </div>
    </article>
  );
}
