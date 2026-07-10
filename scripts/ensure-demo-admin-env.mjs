/**
 * Append demo.admin@landys.pro to ADMIN_EMAILS in .env if missing.
 * Does not print the full ADMIN_EMAILS value.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const path = resolve(process.cwd(), ".env");
const demo = "demo.admin@landys.pro";
let raw = readFileSync(path, "utf8");
const m = raw.match(/^ADMIN_EMAILS=(.*)$/m);
if (!m) {
  raw += `\nADMIN_EMAILS=${demo}\n`;
  writeFileSync(path, raw);
  console.log("ADMIN_EMAILS created with demo admin");
  process.exit(0);
}
const list = m[1]
  .trim()
  .replace(/^["']|["']$/g, "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
if (list.some((e) => e.toLowerCase() === demo)) {
  console.log("demo admin already in ADMIN_EMAILS");
  process.exit(0);
}
list.push(demo);
raw = raw.replace(/^ADMIN_EMAILS=.*$/m, `ADMIN_EMAILS=${list.join(",")}`);
writeFileSync(path, raw);
console.log("demo admin appended to ADMIN_EMAILS");
