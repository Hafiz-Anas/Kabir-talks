"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";

import type { Locale } from "@/i18n";

import type { CommentsLabels } from "./comments-thread";

/**
 * Keeps the article page light: the comments code and data are only fetched
 * when the section comes near the viewport (or the URL points at #comments).
 */
const CommentsThread = lazy(() => import("./comments-thread"));

function CommentsPlaceholder({ label }: { label?: string }) {
  return (
    <div aria-busy className="space-y-3">
      {label && <p className="text-sm text-grey">{label}</p>}
      <div className="h-24 animate-pulse rounded-md bg-obsidian-raised/60" />
    </div>
  );
}

export function LazyComments({ articleId, locale, labels }: { articleId: string; locale: Locale; labels: CommentsLabels }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (location.hash === "#comments" || !("IntersectionObserver" in window)) {
      const timer = setTimeout(() => setVisible(true));
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    const onHash = () => location.hash === "#comments" && setVisible(true);
    window.addEventListener("hashchange", onHash);
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  return (
    <div ref={ref}>
      {visible ? (
        <Suspense fallback={<CommentsPlaceholder label={labels.loading} />}>
          <CommentsThread articleId={articleId} locale={locale} labels={labels} />
        </Suspense>
      ) : (
        <CommentsPlaceholder label={labels.loading} />
      )}
    </div>
  );
}
