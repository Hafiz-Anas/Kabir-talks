"use client";

import { useEffect, useRef } from "react";

import type { AdPlacement } from "@/db/schema/growth";
import type { AdUnitConfig } from "@/server/settings";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * One AdSense unit, built from stored IDs only. Space is reserved up front
 * (no layout jump); if Google has no ad to show, the slot collapses (CSS in
 * globals.css hides .kt-ad when the unit reports "unfilled").
 */
export function AdUnit({
  placement,
  publisherId,
  unit,
  label,
  minHeight,
}: {
  placement: AdPlacement;
  publisherId: string;
  unit: AdUnitConfig;
  label: string;
  minHeight: string;
}) {
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    // Queue the unit; adsbygoogle.js (loaded by AdsLoader) fills it once it arrives.
    if (ref.current && !ref.current.dataset.adsbygoogleStatus) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // An ad blocker or a duplicate push: leave the space empty.
      }
    }
  }, []);

  return (
    <aside aria-label={label} data-placement={placement} className="kt-ad mx-auto my-8 w-full max-w-4xl">
      <p className="mb-1 text-center text-[0.6875rem] tracking-[0.12em] text-grey uppercase">{label}</p>
      <div className={minHeight}>
        <ins
          ref={ref}
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={publisherId}
          data-ad-slot={unit.slotId}
          data-ad-format={unit.format}
          {...(unit.layout ? { "data-ad-layout": unit.layout } : {})}
          {...(unit.layoutKey ? { "data-ad-layout-key": unit.layoutKey } : {})}
          {...(unit.format === "auto" ? { "data-full-width-responsive": "true" } : {})}
        />
      </div>
    </aside>
  );
}
