import type { Metadata } from "next";
import { Suspense } from "react";

import { ContactSettingsForm, OpinionSettingsForm, SocialSettingsForm, YouTubeSettingsForm } from "@/components/admin/settings-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { OPINION_DEFAULTS, readSetting } from "@/server/settings";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl text-ivory">Settings</h1>
        <p className="text-sm text-grey">Site-wide settings. Ads have their own page (Ads).</p>
      </div>
      <Suspense fallback={<Skeleton className="h-40 w-full bg-obsidian-raised" />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  await requireAdmin();
  const [contact, opinion, social, youtube] = await Promise.all([
    readSetting("contact"),
    readSetting("opinion"),
    readSetting("social"),
    readSetting("youtube"),
  ]);
  return (
    <div className="space-y-10">
      <section aria-labelledby="contact-settings" className="space-y-3">
        <h2 id="contact-settings" className="text-xl text-ivory">
          Contact
        </h2>
        <ContactSettingsForm initialEmail={contact.email} />
      </section>
      <section aria-labelledby="social-settings" className="space-y-3">
        <h2 id="social-settings" className="text-xl text-ivory">
          Social links
        </h2>
        <SocialSettingsForm initial={social} />
      </section>
      <section aria-labelledby="youtube-settings" className="space-y-3">
        <h2 id="youtube-settings" className="text-xl text-ivory">
          Latest videos (YouTube)
        </h2>
        <YouTubeSettingsForm initial={youtube} />
      </section>
      <section aria-labelledby="opinion-settings" className="space-y-3">
        <h2 id="opinion-settings" className="text-xl text-ivory">
          Opinion disclaimer
        </h2>
        <OpinionSettingsForm initial={opinion} defaults={OPINION_DEFAULTS} />
      </section>
    </div>
  );
}
