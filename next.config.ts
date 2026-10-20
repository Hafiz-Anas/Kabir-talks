import type { NextConfig } from "next";

/**
 * next/image may only load uploads from our Supabase Storage bucket.
 * The host comes from NEXT_PUBLIC_SUPABASE_URL; without it no remote images are allowed.
 */
function storageImagePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const url = new URL(raw);
    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        port: url.port,
        pathname: "/storage/v1/object/public/article-images/**",
        search: "",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: storageImagePatterns(),
  },
  experimental: {
    // Needed because the app has two root layouts ([locale] and (internal)).
    globalNotFound: true,
    serverActions: {
      // Long articles in two languages (Tiptap JSON) can exceed the 1 MB default.
      // Images never go through server actions (they upload straight to Storage).
      bodySizeLimit: "3mb",
    },
  },
  async redirects() {
    return [{ source: "/", destination: "/en", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
