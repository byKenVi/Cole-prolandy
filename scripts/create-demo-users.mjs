/**
 * Create Clerk demo users for E2E review (admin + contractor).
 * Prints credentials once. Does not log secrets from .env.
 *
 * Usage: node scripts/create-demo-users.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
function get(key) {
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const secret = get("CLERK_SECRET_KEY");
if (!secret) {
  console.error("CLERK_SECRET_KEY missing");
  process.exit(1);
}

const ADMIN_EMAIL = "demo.admin@landys.pro";
const CONTRACTOR_EMAIL = "bigsky@example.com";
const ADMIN_PASSWORD = "LandysAdmin2026!";
const CONTRACTOR_PASSWORD = "LandysPro2026!";

async function findOrCreateUser({ email, password, firstName, lastName }) {
  const listRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  if (!listRes.ok) {
    throw new Error(`Clerk list failed: ${listRes.status} ${await listRes.text()}`);
  }
  const existing = await listRes.json();
  if (Array.isArray(existing) && existing[0]?.id) {
    // Reset password so the shared demo password is known.
    const patch = await fetch(`https://api.clerk.com/v1/users/${existing[0].id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password, skip_password_checks: true }),
    });
    if (!patch.ok) {
      throw new Error(`Clerk password update failed: ${patch.status} ${await patch.text()}`);
    }
    return existing[0].id;
  }

  const create = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
      password,
      first_name: firstName,
      last_name: lastName,
      skip_password_checks: true,
      skip_password_requirement: true,
    }),
  });
  if (!create.ok) {
    throw new Error(`Clerk create failed: ${create.status} ${await create.text()}`);
  }
  const user = await create.json();
  return user.id;
}

const prisma = new PrismaClient();

try {
  const adminId = await findOrCreateUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    firstName: "Demo",
    lastName: "Admin",
  });
  const contractorClerkId = await findOrCreateUser({
    email: CONTRACTOR_EMAIL,
    password: CONTRACTOR_PASSWORD,
    firstName: "Big",
    lastName: "Sky",
  });

  const contractor = await prisma.contractor.findUnique({ where: { email: CONTRACTOR_EMAIL } });
  if (!contractor) {
    console.error(`Contractor ${CONTRACTOR_EMAIL} not in DB — run npm run db:seed first.`);
    process.exit(1);
  }
  await prisma.contractor.update({
    where: { id: contractor.id },
    data: { clerkUserId: contractorClerkId },
  });

  // Ensure ADMIN_EMAILS includes demo admin (local .env hint only — Vercel must match).
  const currentAdmins = (get("ADMIN_EMAILS") || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const needsAdminEnv = !currentAdmins.includes(ADMIN_EMAIL.toLowerCase());

  console.log(
    JSON.stringify(
      {
        ok: true,
        admin: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, clerkUserId: adminId },
        contractor: {
          email: CONTRACTOR_EMAIL,
          password: CONTRACTOR_PASSWORD,
          clerkUserId: contractorClerkId,
          name: contractor.name,
        },
        vercelActionRequired: needsAdminEnv
          ? `Add ${ADMIN_EMAIL} to ADMIN_EMAILS on Vercel (comma-separated with existing admins), then redeploy.`
          : "ADMIN_EMAILS already includes demo admin locally — confirm the same value is set on Vercel.",
        signInPath: "/sign-in",
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
