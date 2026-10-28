"use client";

import { useEffect } from "react";

/** Pages that never show ads, even Auto ads: account and sign-in pages, newsletter links, errors. */
const NO_ADS_PATH = /^\/(en|ur)\/(account|login|signup|forgot-password|reset-password|newsletter)(\/|$)/;

/**
 * Loads Google's adsbygoogle.js once the page is usable (after load, when the
 * browser is idle), so ads never delay the article. Built from the stored
 * publisher ID only. Pages marked data-no-ads (not-found) and the paths
 * above are skipped.
 */
export function AdsLoader({ publisherId }: { publisherId: string }) {
  useEffect(() => {
    if (NO_ADS_PATH.test(window.location.pathname) || document.querySelector("[data-no-ads]")) return;
    if (document.getElementById("kt-adsbygoogle")) return;

    const inject = () => {
      const script = document.createElement("script");
      script.id = "kt-adsbygoogle";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
      document.head.appendChild(script);
    };
    const whenIdle = () =>
      typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(inject, { timeout: 3000 }) : setTimeout(inject, 1500);

    if (document.readyState === "complete") {
      whenIdle();
      return;
    }
    window.addEventListener("load", whenIdle, { once: true });
    return () => window.removeEventListener("load", whenIdle);
  }, [publisherId]);

  return null;
}
