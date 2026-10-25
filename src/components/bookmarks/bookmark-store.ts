"use client";

import { useEffect, useSyncExternalStore } from "react";

import { useSession } from "@/lib/auth-client";

/**
 * Bookmark state for every button on the page, loaded in the browser.
 *
 * Buttons register their article id when they mount; ids registered in the
 * same tick are fetched together, so for a signed-in reader a page of cards
 * costs ONE request (GET /api/reader/bookmarks?ids=…), and for a signed-out
 * visitor none. Cards added later (homepage "Load more") are fetched as one
 * more batch. Toggling is optimistic: the icon
 * flips at once and reverts if the server refuses.
 *
 * The state follows the signed-in user: on sign-in/out (seen through
 * useSession) it is cleared and re-fetched, so nobody sees another
 * account's bookmarks on a shared device.
 */

const MAX_IDS_PER_REQUEST = 60;

let signedIn: boolean | null = null;
let saved = new Set<string>();
let known = new Set<string>();
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let currentUser: string | null | undefined;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function request(articleId: string) {
  if (known.has(articleId) || queue.has(articleId)) return;
  queue.add(articleId);
  schedule();
}

/**
 * Waits for the session (read once by the header): signed-out visitors —
 * most readers — never call the bookmarks endpoint at all.
 */
function schedule() {
  if (currentUser === undefined || !queue.size) return;
  if (currentUser === null) {
    signedIn = false;
    queue.forEach((id) => known.add(id));
    queue = new Set();
    emit();
    return;
  }
  timer ??= setTimeout(flush, 0);
}

async function flush() {
  timer = null;
  const ids = [...queue];
  queue = new Set();
  for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
    const chunk = ids.slice(i, i + MAX_IDS_PER_REQUEST);
    try {
      const res = await fetch(`/api/reader/bookmarks?ids=${chunk.join(",")}`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as { signedIn: boolean; saved: string[] };
      signedIn = data.signedIn;
      chunk.forEach((id) => known.add(id));
      data.saved.forEach((id) => saved.add(id));
    } catch {
      // Offline or server error: buttons stay "not saved"; a click retries through toggle().
    }
  }
  emit();
}

function syncUser(userId: string | null) {
  if (currentUser === userId) return;
  const changed = currentUser !== undefined;
  currentUser = userId;
  if (changed) {
    // Another account (or signed out): forget everything and ask again.
    queue = new Set([...known, ...queue]);
    signedIn = null;
    saved = new Set();
    known = new Set();
    emit();
  }
  schedule();
}

export type ToggleResult = "ok" | "signed-out" | "error";

/** Optimistic save/unsave. "signed-out" means the caller should show the sign-in prompt. */
export async function toggleBookmark(articleId: string): Promise<ToggleResult> {
  if (signedIn === false) return "signed-out";
  const next = !saved.has(articleId);
  const apply = (value: boolean) => {
    if (value) saved.add(articleId);
    else saved.delete(articleId);
    emit();
  };
  apply(next);
  try {
    const res = await fetch("/api/reader/bookmarks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ articleId, saved: next }),
    });
    if (res.ok) return "ok";
    apply(!next);
    if (res.status === 401) {
      signedIn = false;
      emit();
      return "signed-out";
    }
    return "error";
  } catch {
    apply(!next);
    return "error";
  }
}

/** Explicit removal ("My bookmarks" page). Resolves true when the server confirmed it. */
export async function removeBookmark(articleId: string): Promise<boolean> {
  const res = await fetch("/api/reader/bookmarks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ articleId, saved: false }),
  }).catch(() => null);
  if (!res?.ok) return false;
  saved.delete(articleId);
  emit();
  return true;
}

export function useBookmark(articleId: string) {
  const session = useSession();
  const userId = session.isPending ? undefined : (session.data?.user.id ?? null);

  useEffect(() => {
    if (userId !== undefined) syncUser(userId);
  }, [userId]);
  useEffect(() => request(articleId), [articleId]);
  useSyncExternalStore(subscribe, () => version, () => 0);

  return { saved: saved.has(articleId), ready: known.has(articleId), signedIn };
}
