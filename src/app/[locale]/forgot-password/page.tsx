import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuthCard, authMetadata } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";
import { ComingSoon } from "@/components/coming-soon";
import { getDictionary, isLocale } from "@/i18n";
import { features } from "@/lib/features";

/** "Forgot password?" — <ComingSoon /> until account emails are switched on (Phase 7, features.authEmailEnabled). */

export async function generateMetadata({ params }: PageProps<"/[locale]/forgot-password">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { auth } = getDictionary(locale);
  return authMetadata(locale, "forgot-password", auth.forgotTitle, auth.forgotIntro);
}

export default async function ForgotPasswordPage({ params }: PageProps<"/[locale]/forgot-password">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <AuthCard>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl text-ivory">{dict.auth.forgotTitle}</h1>
          {features.authEmailEnabled && <p className="text-sm text-grey">{dict.auth.forgotIntro}</p>}
        </div>
        {features.authEmailEnabled ? (
          <ForgotPasswordForm locale={locale} labels={dict.auth} />
        ) : (
          <ComingSoon variant="panel" label={dict.common.comingSoon} description={dict.auth.forgotComingSoon} className="py-8" />
        )}
        <Link href={`/${locale}/login`} className="inline-block text-sm text-gold hover:text-gold-soft">
          {dict.auth.backToSignIn}
        </Link>
      </div>
    </AuthCard>
  );
}
