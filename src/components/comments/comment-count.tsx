"use client";

import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

import { type Dictionary, fill } from "@/i18n";

/** "12 comments" near the top of an article, linking to the comments. Loaded in the browser (pages stay static). */
export function CommentCount({
  articleId,
  labels,
}: {
  articleId: string;
  labels: Pick<Dictionary["comments"], "count" | "countOne" | "countNone">;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/comments/count?articleId=${articleId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count: number } | null) => !cancelled && data && setCount(data.count))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (count === null) return <span aria-hidden className="inline-block h-5 w-24" />;
  const text = count === 0 ? labels.countNone : count === 1 ? labels.countOne : fill(labels.count, { count });
  return (
    <a href="#comments" className="inline-flex items-center gap-1.5 text-sm text-grey transition-colors hover:text-gold-soft">
      <MessageSquare aria-hidden className="size-4" />
      {text}
    </a>
  );
}
