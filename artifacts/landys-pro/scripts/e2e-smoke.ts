/**
 * End-to-end smoke test of the whole Landy's Pro journey, run against the
 * DEVELOPMENT database (and the running dev server when reachable).
 *
 *   pnpm --filter @workspace/landys-pro run e2e:smoke            # run and clean up
 *   pnpm --filter @workspace/landys-pro run e2e:smoke -- --keep  # keep the test data
 *
 * Journey checked, step by step:
 *   landys.co request (real HTTP endpoint) → routing by category + area →
 *   contractor text + email → accept page → acceptance → homeowner email →
 *   "Did you get the job?" → won → "Have you been paid?" → fee due + pay link →
 *   homeowner "Did you hire?" → direct request → unroutable request alert →
 *   delivery through Twilio / Resend.
 *
 * In development every text and email is redirected to
 * DEVELOPMENT_NOTIFICATION_PHONE / DEVELOPMENT_NOTIFICATION_EMAIL, so the tester
 * receives the full sequence on their own phone and inbox.
 *
 * Refuses to run against production.
 */
import { FollowUpAction } from "@prisma/client";
import { assertNotProductionTarget } from "../lib/ops/database-safety";
import { prisma } from "../lib/prisma";
import { ensureReferenceData } from "../lib/ops/bootstrap";
import { ensureCategory } from "../lib/services/taxonomy-registry";
import { createOfficialEstimateRequest } from "../lib/services/lead-intake";
import { acceptLeadMatch } from "../lib/domain/leads";
import { runScheduledJobs } from "../lib/services/scheduled-jobs";
import { markFollowUpTokenUsed, peekFollowUpToken } from "../lib/domain/follow-up";
import { confirmContractorPaid, reportJobWon } from "../lib/domain/job-outcome";
import { submitLandownerConfirmation } from "../lib/domain/landowner-confirm";
import { dispatchPendingNotifications } from "../lib/notify/outbox";
import { termsSnapshot } from "../lib/terms";

type Status = "PASS" | "FAIL" | "SKIP" | "INFO";
const results: Array<{ step: string; status: Status; detail: string }> = [];
const keep = process.argv.includes("--keep");
const tag = `e2e-${Date.now()}`;
const ZIP = "75948"; // Hemphill, TX
const CATEGORY = "E2E Smoke Test";

function record(step: string, status: Status, detail = "") {
  results.push({ step, status, detail });
  const icon = { PASS: "✔", FAIL: "✘", SKIP: "–", INFO: "i" }[status];
  console.log(`${icon} ${status.padEnd(4)} ${step}${detail ? ` — ${detail}` : ""}`);
}

class StepFailure extends Error {}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new StepFailure(message);
}

async function step<T>(name: string, fn: () => Promise<T>, critical = true): Promise<T | undefined> {
  try {
    const value = await fn();
    if (!results.some((r) => r.step === name)) record(name, "PASS");
    return value;
  } catch (error) {
    record(name, "FAIL", error instanceof Error ? error.message : String(error));
    if (critical) throw new StepFailure(`critical step failed: ${name}`);
    return undefined;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function baseUrl(): string | null {
  const raw =
    process.env.E2E_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null);
  return raw ? raw.replace(/\/+$/, "") : null;
}

async function reachable(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15_000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function getPage(base: string | null, path: string, mustContain: string) {
  if (!base) return "skipped (no reachable dev server)";
  const res = await fetch(`${base}${path}`, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
  expect(res.status === 200, `GET ${path} returned ${res.status}`);
  const html = await res.text();
  expect(html.includes(mustContain), `GET ${path} does not show "${mustContain}"`);
  return "ok";
}

/** Run the scheduler, retrying if another run (cron or opportunistic) holds the lock. */
async function runJobs() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = (await runScheduledJobs()) as { skipped?: string };
    if (!result.skipped) return result;
    await sleep(4000);
  }
  throw new StepFailure("the scheduler stayed locked by another run for 30 seconds");
}

async function messages(where: { leadId?: string; leadMatchId?: string; kind: string }) {
  return prisma.notificationMessage.findMany({
    where: { kind: where.kind, ...(where.leadMatchId ? { leadMatchId: where.leadMatchId } : { leadId: where.leadId }) },
    select: { id: true, channel: true, status: true, lastError: true, sendAfter: true },
  });
}

async function expectQueued(where: { leadId?: string; leadMatchId?: string; kind: string }, channels: Array<"sms" | "email">) {
  const rows = await messages(where);
  for (const channel of channels) {
    expect(rows.some((r) => r.channel === channel), `no ${channel} queued for "${where.kind}"`);
  }
  return rows;
}

async function latestToken(leadMatchId: string, action: FollowUpAction) {
  const token = await prisma.followUpToken.findFirst({
    where: { leadMatchId, action, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  expect(token, `no ${action} link was created`);
  return token.token;
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    source: "general/get-three-estimates",
    externalRequestId: `${tag}-general`,
    firstName: "E2E",
    lastName: "Homeowner",
    phone: "(512) 555-0142",
    email: process.env.DEVELOPMENT_NOTIFICATION_EMAIL ?? "e2e-homeowner@landys.test",
    propertyZip: ZIP,
    contractorCategoryCode: CATEGORY,
    projectTypeCode: "new-build",
    landTypeCode: "residential",
    budget: "under-5k",
    timeline: "within-2-weeks",
    urgency: "medium",
    description: "E2E smoke test request. Roof repair after a storm, water coming in over the kitchen.",
    attachments: [],
    ...overrides,
  };
}

/** Send a request the way landys.co does (HTTP) when possible, otherwise in-process. */
async function submitRequest(base: string | null, body: Record<string, unknown>) {
  const secret = process.env.WIX_ESTIMATE_API_SECRET?.trim();
  if (base && secret && process.env.WIX_ESTIMATE_INTEGRATION_ENABLED === "true") {
    const res = await fetch(`${base}/api/integrations/wix/estimate-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    const json = (await res.json()) as {
      ok: boolean;
      data?: { leadId: string; replay: boolean; reviewStatus: string; blockers: string[] };
      error?: { code: string; message: string };
    };
    expect(json.ok && json.data, `endpoint answered ${res.status}: ${JSON.stringify(json.error ?? json)}`);
    return { ...json.data!, http: res.status, via: "HTTP endpoint" };
  }
  const direct = body.source === "direct-contractor-profile-request";
  const result = await createOfficialEstimateRequest({
    firstName: body.firstName as string,
    lastName: body.lastName as string,
    phone: body.phone as string,
    email: body.email as string,
    propertyZip: body.propertyZip as string,
    contractorCategoryCode: body.contractorCategoryCode as string,
    landTypeCode: body.landTypeCode as string,
    projectTypeCode: body.projectTypeCode as string,
    budget: body.budget as string,
    timelineRaw: body.timeline as string,
    urgency: body.urgency as string,
    description: body.description as string,
    attachments: [],
    source: "wix",
    externalRequestId: body.externalRequestId as string,
    payloadHash: JSON.stringify(body),
    routing: direct
      ? { mode: "direct", contractorSource: "wix", contractorExternalId: body.externalContractorId as string }
      : { mode: "general" },
  });
  return { ...result, http: null, via: "in-process (dev server or secret not available)" };
}

async function main() {
  assertNotProductionTarget({
    landysEnv: process.env.LANDYS_ENV ?? "development",
    allowEnv: ["local", "development", "staging"],
    publicUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  });
  console.log(`\nLandy's Pro end-to-end smoke test (${tag})\n`);

  const candidate = baseUrl();
  const base = candidate && (await reachable(candidate)) ? candidate : null;
  record(
    "Environment",
    "INFO",
    `LANDYS_ENV=${process.env.LANDYS_ENV ?? "?"}; server ${base ?? "not reachable (HTTP checks skipped)"}; texts to ${
      process.env.DEVELOPMENT_NOTIFICATION_PHONE ? "DEVELOPMENT_NOTIFICATION_PHONE" : "NOT SET"
    }; emails to ${process.env.DEVELOPMENT_NOTIFICATION_EMAIL ? "DEVELOPMENT_NOTIFICATION_EMAIL" : "NOT SET"}`,
  );

  // Outside production every message is redirected to a safe test recipient;
  // without those settings every send fails on purpose.
  const env = process.env.LANDYS_ENV ?? "development";
  const overridePrefix = env === "local" ? "LOCAL" : env === "staging" ? "STAGING" : "DEVELOPMENT";
  const missing = [`${overridePrefix}_NOTIFICATION_EMAIL`, `${overridePrefix}_NOTIFICATION_PHONE`].filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missing.length > 0) {
    record(
      "Test recipients configured",
      "FAIL",
      `set ${missing.join(" and ")} in the Replit dev Secrets (your own email and a phone verified in Twilio), then run again`,
    );
    console.log("\nRESULT: FAIL — configure the test recipients first\n");
    await prisma.$disconnect();
    process.exit(1);
  }

  const createdLeadIds: string[] = [];
  let contractorId: string | null = null;
  const categoryIds: string[] = [];

  try {
    await step("Reference data (settings, fee tiers, taxonomy)", async () => {
      await ensureReferenceData(prisma);
    });

    const contractor = await step("Create a test contractor in Hemphill, TX", async () => {
      const category = await ensureCategory(prisma, CATEGORY);
      expect(category, "category could not be created");
      categoryIds.push(category.id);
      const created = await prisma.contractor.create({
        data: {
          name: `E2E Test Roofer ${tag.slice(-6)}`,
          email: `${tag}@landys.test`,
          phone: process.env.DEVELOPMENT_NOTIFICATION_PHONE ?? "+15125550100",
          contractorCategoryId: category.id,
          categoryMemberships: { create: { categoryId: category.id, isPrimary: true } },
          serviceZipCodes: [ZIP],
          externalIdentities: { create: { source: "wix", externalId: `${tag}-wix-id` } },
        },
      });
      contractorId = created.id;
      return created;
    });
    expect(contractor, "no contractor");

    const general = await step("landys.co general request is accepted and routed", async () => {
      const result = await submitRequest(base, payload());
      createdLeadIds.push(result.leadId);
      expect(result.reviewStatus === "routed", `reviewStatus=${result.reviewStatus} blockers=${result.blockers.join(",")}`);
      record("landys.co general request is accepted and routed", "PASS", `${result.via}${result.http ? `, HTTP ${result.http}` : ""}`);
      return result;
    });
    expect(general, "no lead");

    const match = await step("Routing picks the contractor whose area covers the property", async () => {
      const row = await prisma.leadMatch.findUnique({
        where: { leadId_contractorId: { leadId: general.leadId, contractorId: contractor.id } },
      });
      expect(row, "the test contractor did not receive the request");
      const lead = await prisma.lead.findUnique({ where: { id: general.leadId } });
      expect(lead?.budgetBand === "UNDER_5K", `budget "under-5k" not understood (band=${lead?.budgetBand})`);
      return row;
    });
    expect(match, "no match");

    await step("New job request queued by text and email", async () => {
      await sleep(1500);
      await expectQueued({ leadMatchId: match.id, kind: "lead.new" }, ["sms", "email"]);
    });

    await step("Repeating the same request is recognised (no duplicate)", async () => {
      const replay = await submitRequest(base, payload());
      expect(replay.leadId === general.leadId, "a duplicate lead was created");
    }, false);

    await step("Accept page opens without logging in", async () => {
      const detail = await getPage(base, `/accept/${match.acceptToken}`, "Accept this job");
      if (detail !== "ok") record("Accept page opens without logging in", "SKIP", detail);
    }, false);

    await step("Contractor accepts and gets the homeowner's contact", async () => {
      const res = await acceptLeadMatch({
        acceptToken: match.acceptToken,
        actorType: "contractor",
        termsShown: await termsSnapshot({ acceptToken: match.acceptToken }),
      });
      expect(res.status === "accepted", `status=${res.status}`);
      expect(res.contact.landownerEmail, "contact not revealed");
    });

    await step("Homeowner is emailed that a pro will call", async () => {
      await expectQueued({ leadMatchId: match.id, kind: "landowner.contractor_accepted" }, ["email"]);
      const confirmation = await prisma.landownerConfirmation.findUnique({ where: { leadId: general.leadId } });
      expect(confirmation?.sendAfter, "the \"did you hire?\" email was not scheduled");
    });

    await step("\"Did you get the job?\" is sent when due", async () => {
      await prisma.leadMatch.update({ where: { id: match.id }, data: { followUpNextAt: new Date(Date.now() - 60_000) } });
      await runJobs();
      await expectQueued({ leadMatchId: match.id, kind: "followup.outcome" }, ["sms", "email"]);
    });

    const outcomeToken = await step("Follow-up link opens without logging in", async () => {
      const token = await latestToken(match.id, FollowUpAction.REPORT_OUTCOME);
      const detail = await getPage(base, `/follow-up/${token}`, "Did you get the job?");
      if (detail !== "ok") record("Follow-up link opens without logging in", "SKIP", detail);
      return token;
    });
    expect(outcomeToken, "no outcome link");

    await step("Contractor reports the job won at $8,000 (fee 4% = $320)", async () => {
      const row = await peekFollowUpToken(outcomeToken, FollowUpAction.REPORT_OUTCOME);
      const won = await reportJobWon({ leadMatchId: match.id, finalContractValueCents: 800_000 });
      await markFollowUpTokenUsed(row.id);
      expect(won.fee.status === "AWAITING_CONTRACTOR_PAYMENT", `fee status ${won.fee.status}`);
      expect(won.fee.feeAmountCents === 32_000, `fee ${won.fee.feeAmountCents} instead of 32000 (check fee tiers)`);
    });

    await step("\"Have you been paid?\" is sent when due", async () => {
      await prisma.leadMatch.update({ where: { id: match.id }, data: { followUpNextAt: new Date(Date.now() - 60_000) } });
      await runJobs();
      await expectQueued({ leadMatchId: match.id, kind: "followup.payment" }, ["sms", "email"]);
      await latestToken(match.id, FollowUpAction.CONFIRM_PAID);
    });

    await step("Contractor confirms being paid: fee due + payment link sent", async () => {
      const fee = await confirmContractorPaid({ leadMatchId: match.id });
      expect(fee.status === "DUE", `fee status ${fee.status}`);
      await expectQueued({ leadMatchId: match.id, kind: "fee.due" }, ["sms", "email"]);
      const payToken = await latestToken(match.id, FollowUpAction.PAY_FEE);
      const detail = await getPage(base, `/follow-up/${payToken}`, "Pay Landy");
      if (detail !== "ok") record("Contractor confirms being paid: fee due + payment link sent", "PASS", `page check ${detail}`);
    });

    await step("Homeowner is asked \"Did you hire someone?\" and answers", async () => {
      const confirmation = await prisma.landownerConfirmation.findUnique({ where: { leadId: general.leadId } });
      expect(confirmation, "no confirmation row");
      await prisma.landownerConfirmation.update({
        where: { id: confirmation.id },
        data: { sendAfter: new Date(Date.now() - 60_000) },
      });
      await runJobs();
      await expectQueued({ leadId: general.leadId, kind: "landowner.hire_check" }, ["email"]);
      const pageCheck = await getPage(base, `/follow-up/landowner/${confirmation.token}`, "Did you hire someone");
      const answered = await submitLandownerConfirmation({ token: confirmation.token, hired: true, hiredLeadMatchId: match.id });
      expect(answered.respondedAt && !answered.mismatchFlagged, "answer not recorded or wrongly flagged");
      if (pageCheck !== "ok") record("Homeowner is asked \"Did you hire someone?\" and answers", "PASS", `page check ${pageCheck}`);
    });

    await step("Direct request reaches only the chosen contractor", async () => {
      const direct = await submitRequest(
        base,
        payload({
          source: "direct-contractor-profile-request",
          externalRequestId: `${tag}-direct`,
          externalContractorId: `${tag}-wix-id`,
          propertyZip: "78701", // Austin: far from the contractor's area on purpose
        }),
      );
      createdLeadIds.push(direct.leadId);
      expect(direct.reviewStatus === "routed", `reviewStatus=${direct.reviewStatus}`);
      const matches = await prisma.leadMatch.findMany({ where: { leadId: direct.leadId } });
      expect(matches.length === 1 && matches[0].contractorId === contractor.id, "direct request went to the wrong contractors");
    }, false);

    await step("A request nobody can take is held and admins are alerted", async () => {
      const held = await submitRequest(
        base,
        payload({ externalRequestId: `${tag}-nobody`, contractorCategoryCode: "E2E Nobody Category" }),
      );
      createdLeadIds.push(held.leadId);
      const category = await prisma.contractorCategory.findUnique({ where: { code: "e2e-nobody-category" } });
      if (category) categoryIds.push(category.id);
      expect(held.reviewStatus === "pending_review", `reviewStatus=${held.reviewStatus}`);
      expect(held.blockers.includes("no_matching_contractor"), `blockers=${held.blockers.join(",")}`);
      const admins = await prisma.adminUser.count({ where: { disabledAt: null } });
      if (admins > 0 || process.env.ADMIN_EMAILS) {
        await sleep(1000);
        await expectQueued({ leadId: held.leadId, kind: "admin.lead_held" }, ["email"]);
      } else {
        record("A request nobody can take is held and admins are alerted", "PASS", "held correctly (no admin email configured)");
      }
    }, false);

    await step("Texts and emails are delivered (Twilio / Resend)", async () => {
      const ours = await prisma.notificationMessage.findMany({
        where: { OR: [{ leadId: { in: createdLeadIds } }, { contractorId: contractor.id }] },
        select: { id: true },
      });
      await dispatchPendingNotifications({ ids: ours.map((r) => r.id) });
      await sleep(3000);
      const rows = await prisma.notificationMessage.findMany({
        where: { id: { in: ours.map((r) => r.id) } },
        select: { channel: true, status: true, lastError: true, sendAfter: true },
      });
      const count = (status: string) => rows.filter((r) => r.status === status).length;
      const deferred = rows.filter((r) => r.status === "PENDING" && r.sendAfter > new Date()).length;
      const failed = rows.filter((r) => r.status === "FAILED");
      const retrying = rows.filter((r) => r.status === "PENDING" && r.sendAfter <= new Date() && r.lastError);
      const summary = `${count("SENT")} sent, ${deferred} held for quiet hours (texts after 9 pm / before 8 am Texas time), ${count("SKIPPED")} skipped, ${failed.length} failed`;
      const problems = [...failed, ...retrying].map((r) => `${r.channel}: ${r.lastError}`).slice(0, 3);
      expect(failed.length === 0 && retrying.length === 0, `${summary}. ${problems.join(" | ")}`);
      record("Texts and emails are delivered (Twilio / Resend)", "PASS", summary);
    }, false);
  } catch (error) {
    if (!(error instanceof StepFailure)) record("Unexpected error", "FAIL", error instanceof Error ? error.stack ?? error.message : String(error));
  } finally {
    if (!keep) {
      await prisma.lead
        .updateMany({ where: { id: { in: createdLeadIds } }, data: { status: "CLOSED", expiresAt: new Date() } })
        .catch(() => undefined);
      if (contractorId) {
        await prisma.contractor
          .update({ where: { id: contractorId }, data: { deactivatedAt: new Date(), deactivationSource: "admin" } })
          .catch(() => undefined);
      }
      await prisma.contractorCategory
        .updateMany({ where: { id: { in: categoryIds } }, data: { archivedAt: new Date(), isActiveForNewIntake: false } })
        .catch(() => undefined);
      record("Cleanup", "INFO", "test requests closed, test contractor deactivated, test categories archived (use --keep to inspect them)");
    } else {
      record("Cleanup", "INFO", `kept: contractor ${contractorId}, leads ${createdLeadIds.join(", ")}`);
    }
    const failed = results.filter((r) => r.status === "FAIL");
    const passed = results.filter((r) => r.status === "PASS").length;
    console.log(`\n${failed.length === 0 ? "RESULT: PASS" : "RESULT: FAIL"} — ${passed} passed, ${failed.length} failed\n`);
    await prisma.$disconnect();
    process.exit(failed.length === 0 ? 0 : 1);
  }
}

void main();
