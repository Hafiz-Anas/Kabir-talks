import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AuthCard, AuthFormSkeleton, authMetadata } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { getDictionary, isLocale } from "@/i18n";
import { features } from "@/lib/features";

/** Sign-up (always creates a "reader"; see src/lib/auth.ts). Static: the form reads ?next= in the browser. */

export async function generateMetadata({ params }: PageProps<"/[locale]/signup">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { auth } = getDictionary(locale);
  return authMetadata(locale, "signup", auth.signUpTitle, auth.signUpIntro);
}

export default async function SignupPage({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { auth } = getDictionary(locale);

  return (
    <AuthCard>
      <Suspense fallback={<AuthFormSkeleton />}>
        <AuthForm
          mode="sign-up"
          locale={locale}
          labels={auth}
          googleEnabled={features.googleAuthEnabled}
          emailEnabled={features.authEmailEnabled}
        />
      </Suspense>
    </AuthCard>
  );
}
