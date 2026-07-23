export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_APP_URL is required in production.");
    }
    // In the Replit dev environment, use the proxied dev domain so invitation
    // links point to the real URL instead of localhost:3000.
    const replitDomain = process.env.REPLIT_DEV_DOMAIN;
    if (replitDomain) return `https://${replitDomain}`;
    return "http://localhost:3000";
  }

  const parsed = new URL(configured);
  if (
    process.env.NODE_ENV === "production" &&
    (parsed.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(parsed.hostname))
  ) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a public HTTPS URL in production.");
  }
  return configured;
}
