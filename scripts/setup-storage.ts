import "../src/db/load-env";

import { StorageClient } from "@supabase/storage-js";

import { ARTICLE_IMAGE_BUCKET } from "../src/lib/content/urls";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "../src/lib/uploads/file-type";

/**
 * Creates (or updates) the public-read "article-images" bucket:
 *   npm run storage:setup
 *
 * - public: true      → anyone can READ objects via their public URL
 * - no upload policies → only the server (service role key) can write
 * - size + MIME limits enforced by Storage itself, as a second line of defence
 */
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");

  const storage = new StorageClient(`${new URL(url).origin}/storage/v1`, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
  const options = {
    public: true,
    fileSizeLimit: MAX_IMAGE_BYTES,
    allowedMimeTypes: Object.keys(IMAGE_TYPES),
  };

  const { data: existing } = await storage.getBucket(ARTICLE_IMAGE_BUCKET);
  const { error } = existing
    ? await storage.updateBucket(ARTICLE_IMAGE_BUCKET, options)
    : await storage.createBucket(ARTICLE_IMAGE_BUCKET, options);
  if (error) throw error;

  console.log(`✔ Bucket "${ARTICLE_IMAGE_BUCKET}" ${existing ? "updated" : "created"}: public read, 5 MB max, ${options.allowedMimeTypes.join(", ")}`);
}

main().catch((error) => {
  console.error("✖ Storage setup failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
