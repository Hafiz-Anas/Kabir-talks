import Link from "next/link";

import { Logo } from "@/components/layout/logo";

export default function InternalNotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      <Logo href="/en" showWordmark={false} />
      <p className="font-serif text-6xl text-gold">404</p>
      <h1 className="text-2xl text-ivory">Page not found</h1>
      <Link href="/en" className="text-gold transition-colors hover:text-gold-soft">
        Back to homepage
      </Link>
    </div>
  );
}
