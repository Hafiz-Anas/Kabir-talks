import type { Metadata } from "next";
import { Suspense } from "react";

import { Logo } from "@/components/layout/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { features } from "@/lib/features";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <Logo href="/en" />
        </div>
        <div className="rounded-md border border-border bg-obsidian p-6 sm:p-8">
          {/* The form reads ?next= from the URL, so it renders at request time. */}
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm googleEnabled={features.googleAuthEnabled} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <Skeleton className="h-7 w-32 bg-obsidian-raised" />
      <Skeleton className="h-9 w-full bg-obsidian-raised" />
      <Skeleton className="h-9 w-full bg-obsidian-raised" />
      <Skeleton className="h-9 w-full bg-obsidian-raised" />
    </div>
  );
}
