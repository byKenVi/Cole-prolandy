import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, siteUrl } from "@/lib/site";

/** Only the public pages; contractor, admin and link pages are never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date("2026-11-17T00:00:00Z");
  return PUBLIC_PAGES.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: path === "/" ? "monthly" : "yearly",
    priority: path === "/" ? 1 : 0.4,
  }));
}
