/**
 * Prints only presence flags for auth-related env (no secret values).
 * Usage: node scripts/check-auth-env.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
function get(key) {
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const adminEmails = (get("ADMIN_EMAILS") || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

console.log(
  JSON.stringify(
    {
      AUTH_MODE: get("AUTH_MODE") || "(unset)",
      NEXT_PUBLIC_APP_URL: get("NEXT_PUBLIC_APP_URL") || "(unset)",
      hasClerkSecret: Boolean(get("CLERK_SECRET_KEY")),
      hasClerkPublishable: Boolean(get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")),
      adminEmailCount: adminEmails.length,
      // Masked: show only domain for first admin email so we know which inbox to use
      adminEmailHint: adminEmails[0]
        ? adminEmails[0].replace(/^(.{2}).*(@.*)$/, "$1***$2")
        : null,
    },
    null,
    2,
  ),
);
