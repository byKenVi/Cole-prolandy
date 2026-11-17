import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Crawling stays open so Google can read the noindex header of private pages
 * (sent from next.config.ts); only machine endpoints are blocked.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dev/", "/storage/"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
