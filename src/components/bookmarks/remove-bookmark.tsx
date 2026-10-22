"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { removeBookmark } from "./bookmark-store";

/** "Remove" under a card on My bookmarks: removes on the server, then re-renders the list. */
export function RemoveBookmark({ articleId, label, errorLabel }: { articleId: string; label: string; errorLabel: string }) {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(false);
            if (await removeBookmark(articleId)) router.refresh();
            else setError(true);
          })
        }
        className="inline-flex items-center gap-1.5 rounded-sm px-1 py-1 text-sm text-grey transition-colors hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
      >
        <X aria-hidden className="size-4" />
        {label}
      </button>
      <span role="status" className="text-xs text-destructive">
        {error ? errorLabel : ""}
      </span>
    </div>
  );
}
