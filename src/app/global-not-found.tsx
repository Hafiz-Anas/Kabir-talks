import "./globals.css";

import type { Metadata } from "next";
import Link from "next/link";

import { fontVariables } from "@/lib/fonts";

/** 404 for URLs that match no route at all (e.g. /fr or /en/a/b/c/d). */

export const metadata: Metadata = {
  title: "Page not found Â· Kabir Talks",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" dir="ltr" className={fontVariables}>
      <body className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
        <p className="font-serif text-6xl text-gold">404</p>
        <h1 className="text-3xl text-ivory">Page not found</h1>
        <p className="font-urdu text-grey" lang="ur" dir="rtl">
          ØµÙØ­Û Ù†ÛÛŒÚº Ù…Ù„Ø§
        </p>
        <div className="flex gap-6">
          <Link href="/en" className="text-gold hover:text-gold-soft">
            English
          </Link>
          <Link href="/ur" lang="ur" className="font-urdu text-gold hover:text-gold-soft">
            Ø§Ø±Ø¯Ùˆ
          </Link>
        </div>
      </body>
    </html>
  );
}
