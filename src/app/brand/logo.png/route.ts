import { cacheLife } from "next/cache";

import { logoImageResponse } from "@/server/og/share-image";

/** GET /brand/logo.png — square publisher logo for structured data (Organization, NewsArticle publisher). */

async function renderPng(): Promise<Uint8Array> {
  "use cache";
  cacheLife("max");
  return new Uint8Array(await (await logoImageResponse()).arrayBuffer());
}

export async function GET() {
  return new Response((await renderPng()) as BodyInit, {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=604800, s-maxage=604800" },
  });
}
