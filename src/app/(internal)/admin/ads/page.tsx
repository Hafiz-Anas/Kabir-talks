import type { Metadata } from "next";
import { Suspense } from "react";

import { AdPlacementForm, AdsSettingsForm } from "@/components/admin/ads-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { env } from "@/lib/env";
import { loadAdsAdmin } from "@/server/ads-actions";

export const metadata: Metadata = { title: "Ads" };

export default function AdsAdminPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl text-ivory">Ads</h1>
        <p className="text-sm text-grey">
          Google AdSense. Paste the code AdSense gives you: only the IDs are kept, and the site builds the ad code itself. Ads never appear in the
          admin, on account pages or on error pages.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full bg-obsidian-raised" />}>
        <Ads />
      </Suspense>
    </div>
  );
}

async function Ads() {
  await requireAdmin();
  const { settings, placements } = await loadAdsAdmin();
  const preview = env.NODE_ENV !== "production";

  return (
    <>
      {preview && (
        <p className="rounded-md border border-gold-muted/50 bg-obsidian px-4 py-3 text-sm text-grey">
          <span className="text-gold">Preview mode:</span> this isn’t a production build, so the site shows grey boxes named after each placement
          instead of real ads, and Google’s script isn’t loaded.
        </p>
      )}

      <section aria-labelledby="ads-account" className="space-y-3">
        <h2 id="ads-account" className="text-xl text-ivory">
          Account
        </h2>
        <AdsSettingsForm initial={settings} />
        <p className="text-sm text-grey">
          {settings.publisherId ? (
            <>
              <a href="/ads.txt" target="_blank" rel="noopener" className="text-gold hover:text-gold-soft">
                /ads.txt
              </a>{" "}
              is published automatically from this ID.
            </>
          ) : (
            "/ads.txt appears once a publisher ID is saved."
          )}{" "}
          Before going live, switch on AdSense’s “Privacy &amp; messaging” consent message (needed for visitors in the EEA and UK).
        </p>
      </section>

      <section aria-labelledby="ads-placements" className="space-y-3">
        <h2 id="ads-placements" className="text-xl text-ivory">
          Placements
        </h2>
        <p className="text-sm text-grey">
          A placement shows only when ads are on, it is switched on, and it has a valid ad unit. Otherwise it takes up no space at all.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {placements.map((p) => (
            <AdPlacementForm key={p.placement} placement={p.placement} initial={p} publisherId={settings.publisherId} />
          ))}
        </div>
      </section>
    </>
  );
}
