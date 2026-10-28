import { AdsLoader } from "@/components/ads/ads-loader";
import { AdUnit } from "@/components/ads/ad-unit";
import type { AdPlacement } from "@/db/schema/growth";
import { getDictionary, type Locale } from "@/i18n";
import { AD_PLACEMENT_INFO } from "@/lib/ads";
import { env } from "@/lib/env";
import { getPublicAdsConfig } from "@/server/settings";

/**
 * An ad position (Phase 7). Renders NOTHING — no wrapper, no spacing — when
 * ads are off, the placement is switched off or has no valid slot ID, so
 * pages never get gaps. Otherwise it reserves the unit's space with a small
 * "Advertisement" label. Outside production it shows a grey placeholder
 * named after the placement instead of a real ad.
 *
 * Only used on the homepage and article pages: never in the admin, account
 * pages or error pages. Config is a cached read, so pages stay static.
 */
export async function AdSlot({ placement, locale }: { placement: AdPlacement; locale: Locale }) {
  const config = await getPublicAdsConfig();
  const unit = config?.placements[placement];
  if (!config || !unit) return null;

  const info = AD_PLACEMENT_INFO[placement];
  const label = getDictionary(locale).common.advertisement;

  if (env.NODE_ENV !== "production") {
    return (
      <aside aria-label={label} data-placement={placement} className="mx-auto my-8 w-full max-w-4xl">
        <p className="mb-1 text-center text-[0.6875rem] tracking-[0.12em] text-grey uppercase">{label}</p>
        <div
          className={`${info.minHeight} grid place-items-center rounded-sm border border-dashed border-grey-dim bg-obsidian-raised text-sm text-grey`}
          lang="en"
          dir="ltr"
        >
          Ad preview · {placement} · slot {unit.slotId}
        </div>
      </aside>
    );
  }

  return <AdUnit placement={placement} publisherId={config.publisherId} unit={unit} label={label} minHeight={info.minHeight} />;
}

/** Loads adsbygoogle.js on public pages when anything needs it (a unit or Auto ads). Production only. */
export async function AdsScript() {
  if (env.NODE_ENV !== "production") return null;
  const config = await getPublicAdsConfig();
  if (!config || (!config.autoAds && Object.keys(config.placements).length === 0)) return null;
  return <AdsLoader publisherId={config.publisherId} />;
}
