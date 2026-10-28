import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/seo";

/** /robots.txt (Phase 7): public pages are open; the admin, the API and reader account pages are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/en/account", "/ur/account", "/en/newsletter/", "/ur/newsletter/"],
      },
    ],
    sitemap: [siteUrl("/sitemap.xml"), siteUrl("/news-sitemap.xml")],
  };
}
