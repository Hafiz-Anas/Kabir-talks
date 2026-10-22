import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AuthCard, AuthFormSkeleton, authMetadata } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { getDictionary, isLocale } from "@/i18n";
import { features } from "@/lib/features";

/** Sign-in. Static: the form reads ?next= in the browser. The old /login redirects here (next.config.ts). */

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { auth } = getDictionary(locale);
  return authMetadata(locale, "login", auth.signInTitle, auth.signInIntro);
}

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { auth } = getDictionary(locale);

  return (
    <AuthCard>
      <Suspense fallback={<AuthFormSkeleton />}>
        <AuthForm
          mode="sign-in"
          locale={locale}
          labels={auth}
          googleEnabled={features.googleAuthEnabled}
          emailEnabled={features.authEmailEnabled}
        />
      </Suspense>
    </AuthCard>
  );
}
