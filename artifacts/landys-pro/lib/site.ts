/** Public identity of the app, used for SEO metadata, robots.txt and the sitemap. */
export const SITE_NAME = "Landy's Pro";
export const SITE_TITLE = "Landy's Pro: job requests from homeowners near you";
export const SITE_DESCRIPTION =
  "Landy's Pro sends local contractors estimate requests from homeowners on landys.co, by text and email. No lead fees, no subscription: pay a small success fee only after you get paid.";

/** Absolute origin of this deployment (never throws, unlike appUrl()). */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:3000";
}

/** Pages Google may index. Everything else is private (noindex). */
export const PUBLIC_PAGES = ["/", "/terms", "/privacy"] as const;
