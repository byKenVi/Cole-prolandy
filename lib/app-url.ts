export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_APP_URL is required in production.");
    }
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
