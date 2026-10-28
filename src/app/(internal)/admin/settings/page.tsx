import type { Metadata } from "next";
import { Suspense } from "react";

import { ContactSettingsForm } from "@/components/admin/settings-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { readSetting } from "@/server/settings";

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
  const contact = await readSetting("contact");
  return (
    <section aria-labelledby="contact-settings" className="space-y-3">
      <h2 id="contact-settings" className="text-xl text-ivory">
        Contact
      </h2>
      <ContactSettingsForm initialEmail={contact.email} />
    </section>
  );
}
