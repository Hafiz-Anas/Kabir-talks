import type { AdPlacement } from "@/db/schema/growth";

/**
 * Reserved ad position. Renders NOTHING in Phase 4 — no wrapper, no spacing —
 * so pages have no gaps. Phase 7 wires this to the ad_slots table and the
 * admin toggle (placements: AD_PLACEMENTS in src/db/schema/growth.ts).
 */
export function AdSlot({ placement }: { placement: AdPlacement }) {
  void placement;
  return null;
}
