"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AdPlacement } from "@/db/schema/growth";
import { AD_PLACEMENT_INFO, adsTxtLine, extractPublisherId, parseAdUnit } from "@/lib/ads";
import { cn } from "@/lib/utils";
import { type AdsActionResult, saveAdPlacement, saveAdsSettings } from "@/server/ads-actions";

function Result({ result }: { result: AdsActionResult | null }) {
  if (!result) return null;
  return (
    <p role="status" className={cn("text-sm", result.ok ? "text-gold" : "text-destructive")}>
      {result.ok ? result.message : result.error}
    </p>
  );
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm text-ivory">
          {label}
        </label>
        {hint && <p className="text-xs text-grey">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function AdsSettingsForm({ initial }: { initial: { publisherId: string | null; enabled: boolean; autoAds: boolean } }) {
  const router = useRouter();
  const id = useId();
  const [publisher, setPublisher] = useState(initial.publisherId ?? "");
  const [enabled, setEnabled] = useState(initial.enabled);
  const [autoAds, setAutoAds] = useState(initial.autoAds);
  const [result, setResult] = useState<AdsActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const check = publisher.trim() ? extractPublisherId(publisher) : null;

  return (
    <form
      className="space-y-5 rounded-md border border-border bg-obsidian p-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const outcome = await saveAdsSettings({ publisher, enabled, autoAds });
          setResult(outcome);
          if (outcome.ok) router.refresh();
        });
      }}
    >
      <div className="space-y-2">
        <label htmlFor={id} className="text-sm text-ivory">
          AdSense publisher ID
        </label>
        <Textarea
          id={id}
          value={publisher}
          onChange={(event) => setPublisher(event.target.value)}
          rows={2}
          spellCheck={false}
          dir="ltr"
          placeholder="ca-pub-0000000000000000, or paste the AdSense <script> code"
          aria-describedby={`${id}-check`}
          className="font-mono text-xs"
        />
        <p id={`${id}-check`} className={cn("text-xs", check && !check.ok ? "text-destructive" : "text-grey")}>
          {check
            ? check.ok
              ? `Found ${check.value}. Only this ID is saved, never the pasted code.`
              : check.error
            : "AdSense → Account → Settings → Account information, or paste the code AdSense gives you: only the ID is kept."}
        </p>
        {check?.ok && (
          <p className="text-xs text-grey">
            ads.txt will say: <code className="text-ivory">{adsTxtLine(check.value)}</code>
          </p>
        )}
      </div>

      <SwitchRow label="Show ads" hint="Master switch. Off hides every placement and Auto ads." checked={enabled} onChange={setEnabled} />
      <SwitchRow
        label="Auto ads"
        hint="Loads Google’s script on public pages so AdSense can place ads itself. Turn Auto ads on or off in your AdSense account too."
        checked={autoAds}
        onChange={setAutoAds}
      />

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending} className="hover:bg-gold-soft">
          {pending ? "Saving…" : "Save"}
        </Button>
        <Result result={result} />
      </div>
    </form>
  );
}

export function AdPlacementForm({
  placement,
  initial,
  publisherId,
}: {
  placement: AdPlacement;
  initial: { enabled: boolean; slotId: string | null; format: string; layout: string | null; layoutKey: string | null };
  publisherId: string | null;
}) {
  const router = useRouter();
  const id = useId();
  const [unit, setUnit] = useState(initial.slotId ?? "");
  const [enabled, setEnabled] = useState(initial.enabled);
  const [result, setResult] = useState<AdsActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  // A bare saved slot ID re-parses as "auto"; show what is stored until the field changes.
  const changed = unit !== (initial.slotId ?? "");
  const check = unit.trim() ? parseAdUnit(unit, publisherId) : null;
  const info = AD_PLACEMENT_INFO[placement];

  return (
    <form
      className="space-y-3 rounded-md border border-border bg-obsidian p-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const outcome = await saveAdPlacement({ placement, enabled, unit: changed ? unit : (initial.slotId ?? "") });
          setResult(outcome);
          if (outcome.ok) router.refresh();
        });
      }}
    >
      <SwitchRow label={`${info.label} (${placement})`} checked={enabled} onChange={setEnabled} />
      <label htmlFor={id} className="sr-only">
        Ad unit code or slot ID for {info.label}
      </label>
      <Textarea
        id={id}
        value={unit}
        onChange={(event) => setUnit(event.target.value)}
        rows={2}
        spellCheck={false}
        dir="ltr"
        placeholder='Slot ID (e.g. 1234567890) or the ad unit code (<ins class="adsbygoogle" … data-ad-slot="…">)'
        aria-describedby={`${id}-check`}
        className="font-mono text-xs"
      />
      <p id={`${id}-check`} className={cn("text-xs", check && !check.ok ? "text-destructive" : "text-grey")}>
        {!changed && initial.slotId
          ? `Saved: slot ${initial.slotId}, format ${initial.format}${initial.layout ? `, layout ${initial.layout}` : ""}${initial.layoutKey ? `, key ${initial.layoutKey}` : ""}.`
          : check
            ? check.ok
              ? `Found slot ${check.value.slotId}, format ${check.value.format}${check.value.layout ? `, layout ${check.value.layout}` : ""}.`
              : check.error
            : "Empty: this placement shows nothing."}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="sm" variant="outline" disabled={pending} className="bg-transparent">
          {pending ? "Saving…" : "Save placement"}
        </Button>
        <Result result={result} />
      </div>
    </form>
  );
}
