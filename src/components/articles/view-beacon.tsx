"use client";

import { useEffect } from "react";

/**
 * Counts one view of a static article page, from the browser: only when the
 * page is actually shown (a background tab waits until it is opened), never
 * for automated browsers. The server dedupes per visitor per day.
 */
export function ViewBeacon({ articleId }: { articleId: string }) {
  useEffect(() => {
    if (navigator.webdriver) return;
    let sent = false;
    const send = () => {
      if (sent || document.visibilityState !== "visible") return;
      sent = true;
      document.removeEventListener("visibilitychange", send);
      fetch("/api/views", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ articleId }),
        keepalive: true,
      }).catch(() => {});
    };
    // A short delay skips bounces and lets the article render first.
    const timer = window.setTimeout(send, 1500);
    document.addEventListener("visibilitychange", send);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", send);
    };
  }, [articleId]);

  return null;
}
