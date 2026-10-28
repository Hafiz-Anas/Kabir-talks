import { adsTxtLine } from "@/lib/ads";
import { getPublisherId } from "@/server/settings";

/**
 * /ads.txt for AdSense, generated from the publisher ID saved in Admin → Ads.
 * 404 until an ID is saved. The read is cached and expires when the admin saves.
 */
export async function GET() {
  const publisherId = await getPublisherId();
  if (!publisherId) return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(`${adsTxtLine(publisherId)}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
