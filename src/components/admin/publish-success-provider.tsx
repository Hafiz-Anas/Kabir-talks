"use client";

import { createContext, use, useCallback, useState } from "react";

import type { PublishedInfo } from "@/server/article-actions";

import { PublishSuccessDialog } from "./publish-dialogs";

type ShowPublished = (info: PublishedInfo, options?: { editHref?: string }) => void;

const PublishSuccessContext = createContext<ShowPublished | null>(null);

/**
 * Hosts the "Published!" dialog in the admin layout, so it survives the
 * component that triggered it being unmounted. Publishing revalidates paths,
 * which refreshes the router: a new article's editor (URL swapped from /new
 * to /{id}) remounts, and a list row filtered to Drafts disappears.
 */
export function PublishSuccessProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ info: PublishedInfo; editHref?: string } | null>(null);
  const show = useCallback<ShowPublished>((info, options) => setState({ info, editHref: options?.editHref }), []);

  return (
    <PublishSuccessContext value={show}>
      {children}
      <PublishSuccessDialog info={state?.info ?? null} editHref={state?.editHref} onOpenChange={() => setState(null)} />
    </PublishSuccessContext>
  );
}

export function useShowPublished(): ShowPublished {
  const show = use(PublishSuccessContext);
  if (!show) throw new Error("useShowPublished must be used inside <PublishSuccessProvider>");
  return show;
}
