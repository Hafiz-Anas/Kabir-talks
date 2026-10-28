import "../globals.css";

import type { Metadata } from "next";

import { ThemeScript } from "@/components/theme/theme-script";
import { fontVariables } from "@/lib/fonts";

/**
 * Root layout for non-localised pages (/admin). English UI, LTR.
 * The "(internal)" route group does not appear in URLs.
 */

export const metadata: Metadata = {
  title: { default: "Kabir Talks", template: "%s · Kabir Talks" },
  robots: { index: false, follow: false },
};

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
