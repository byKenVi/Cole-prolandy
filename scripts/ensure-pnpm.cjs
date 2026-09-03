/**
 * Cross-platform preinstall guard (works on Windows without `sh`).
 * Removes npm/yarn lockfiles and refuses non-pnpm package managers.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
for (const file of ["package-lock.json", "yarn.lock"]) {
  try {
    fs.unlinkSync(path.join(root, file));
  } catch {
    // absent is fine
  }
}

const ua = process.env.npm_config_user_agent || "";
if (!ua.includes("pnpm/")) {
  console.error("Use pnpm instead of npm/yarn for this workspace.");
  process.exit(1);
}
