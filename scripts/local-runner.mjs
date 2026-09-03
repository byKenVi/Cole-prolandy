import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, "artifacts", "landys-pro");
const command = process.argv[2];

process.env.LANDYS_ENV = "local";
process.env.NODE_ENV = command === "start" ? "production" : "development";
// Local QA uses the session/direct endpoint. The transaction-pooler port is not
// consistently reachable from developer machines, and all local commands are
// already protected by the DEV project-ref guard in local-database.ts.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
if (!process.env.SUPABASE_URL && process.env.LOCAL_SUPABASE_PROJECT_REF) {
  process.env.SUPABASE_URL = `https://${process.env.LOCAL_SUPABASE_PROJECT_REF}.supabase.co`;
}

const nextCli = path.join(appRoot, "node_modules", "next", "dist", "bin", "next");
const tsxCli = path.join(appRoot, "node_modules", "tsx", "dist", "cli.mjs");

const commands = {
  dev: [nextCli, "dev", "-H", "0.0.0.0", "-p", "3000"],
  start: [nextCli, "start", "-H", "0.0.0.0", "-p", "3000"],
  reseed: [tsxCli, path.join(appRoot, "scripts", "local-database.ts"), "reseed"],
  "clerk-qa": [tsxCli, path.join(appRoot, "scripts", "local-clerk-qa.ts")],
  verify: [tsxCli, path.join(appRoot, "scripts", "local-database.ts"), "verify"],
  storage: [tsxCli, path.join(appRoot, "scripts", "local-storage.ts")],
  stripe: [tsxCli, path.join(appRoot, "scripts", "local-stripe-smoke.ts")],
  wix: [tsxCli, path.join(appRoot, "scripts", "local-wix-intake.ts")],
};

const args = commands[command];
if (!args) {
  throw new Error("Usage: local-runner.mjs <dev|start|reseed|clerk-qa|verify|storage|stripe|wix>");
}

const result = spawnSync(process.execPath, args, {
  cwd: appRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
