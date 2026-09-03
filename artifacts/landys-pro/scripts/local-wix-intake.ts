/**
 * Controlled local Wix estimate-request intake.
 * Hits the SAME API contract as Landys.co without pointing the live Wix site at localhost.
 *
 * Usage (app must be running locally with WIX_ESTIMATE_INTEGRATION_ENABLED=true):
 *   pnpm local:wix-intake
 */
import { assertNotProductionTarget } from "../lib/ops/database-safety";
import { WIX_ESTIMATE_REQUEST_SOURCE } from "../lib/integrations/wix/estimate-contract";

async function main() {
  assertNotProductionTarget({
    landysEnv: process.env.LANDYS_ENV ?? "local",
    allowEnv: ["local", "development"],
    publicUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  });

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const secret = process.env.WIX_ESTIMATE_API_SECRET?.trim();
  if (!secret) {
    throw new Error("WIX_ESTIMATE_API_SECRET is required for local Wix intake.");
  }
  if (process.env.WIX_ESTIMATE_INTEGRATION_ENABLED !== "true") {
    throw new Error('Set WIX_ESTIMATE_INTEGRATION_ENABLED="true" in your local env.');
  }

  const externalRequestId = `local-wix-${Date.now()}`;
  const payload = {
    source: WIX_ESTIMATE_REQUEST_SOURCE.GENERAL,
    externalRequestId,
    firstName: "Local",
    lastName: "WixTest",
    email: "wix-local@localhost.test",
    phone: "+15555550888",
    propertyZip: "78702",
    contractorCategoryCode: "general-contractor",
    landTypeCode: "residential",
    projectTypeCode: "new-build",
    budget: "17500",
    budgetCents: 1_750_000,
    budgetBand: "BETWEEN_15K_50K",
    timeline: "within-1-month",
    urgency: "medium",
    description: "Controlled local Wix estimate fixture for QA matching and opportunity creation.",
  };

  const res = await fetch(`${base}/api/integrations/wix/estimate-requests`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(body, null, 2));
  if (!res.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
