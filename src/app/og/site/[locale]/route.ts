import { cacheLife } from "next/cache";

import { isLocale, type Locale } from "@/i18n";
import { siteShareImageResponse } from "@/server/og/share-image";

/** GET /og/site/{locale} — branded 1200×630 share image for pages without their own. */

async function renderPng(locale: Locale): Promise<Uint8Array> {
  "use cache";
  cacheLife("weeks");
  const image = await siteShareImageResponse(locale);
  return new Uint8Array(await image.arrayBuffer());
}

export async function GET(_request: Request, { params }: RouteContext<"/og/site/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404 });
  return new Response((await renderPng(locale)) as BodyInit, {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400, s-maxage=86400" },
  });
}
