import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AuthCard, AuthFormSkeleton, authMetadata } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { ComingSoon } from "@/components/coming-soon";
import { getDictionary, isLocale } from "@/i18n";
import { features } from "@/lib/features";

/** Target of the reset link in the password email (Phase 7). Reads ?token= in the browser. */

export async function generateMetadata({ params }: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { auth } = getDictionary(locale);
  return authMetadata(locale, "reset-password", auth.resetTitle, auth.resetTitle);
}

export default async function ResetPasswordPage({ params }: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <AuthCard>
      <div className="space-y-6">
        <h1 className="text-2xl text-ivory">{dict.auth.resetTitle}</h1>
        {features.authEmailEnabled ? (
          <Suspense fallback={<AuthFormSkeleton />}>
            <ResetPasswordForm locale={locale} labels={dict.auth} />
          </Suspense>
        ) : (
          <ComingSoon variant="panel" label={dict.common.comingSoon} description={dict.auth.forgotComingSoon} className="py-8" />
        )}
      </div>
    </AuthCard>
  );
}
