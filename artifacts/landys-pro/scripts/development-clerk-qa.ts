/**
 * Ensure two password users in Replit-managed Clerk Development and link them
 * to the already-seeded Development admin/contractor records.
 */
import { PrismaClient } from "@prisma/client";

type ClerkUser = { id: string };

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function testKey(): string {
  const value = required("CLERK_SECRET_KEY");
  if (!value.startsWith("sk_test_")) {
    throw new Error("Refusing: Development Clerk requires an sk_test_ key.");
  }
  return value;
}

async function clerkFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${testKey()}`);
  if (init.body) headers.set("Content-Type", "application/json");
  return fetch(`https://api.clerk.com/v1${path}`, { ...init, headers });
}

async function findUser(email: string): Promise<ClerkUser | null> {
  const response = await clerkFetch(`/users?email_address=${encodeURIComponent(email)}&limit=1`);
  if (!response.ok) throw new Error(`Clerk user lookup failed (${response.status}).`);
  const users = (await response.json()) as ClerkUser[];
  return users[0] ?? null;
}

async function ensureUser(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<ClerkUser> {
  const existing = await findUser(params.email);
  if (existing) {
    const response = await clerkFetch(`/users/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        password: params.password,
        skip_password_checks: true,
        sign_out_of_other_sessions: false,
      }),
    });
    if (!response.ok) throw new Error(`Clerk password update failed (${response.status}).`);
    return existing;
  }

  const response = await clerkFetch("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [params.email],
      password: params.password,
      first_name: params.firstName,
      last_name: params.lastName,
      skip_password_checks: true,
      skip_password_requirement: false,
    }),
  });
  if (!response.ok) throw new Error(`Clerk user creation failed (${response.status}).`);
  return (await response.json()) as ClerkUser;
}

async function main() {
  if ((process.env.LANDYS_ENV ?? "development") !== "development") {
    throw new Error('Refusing: LANDYS_ENV must be exactly "development".');
  }
  const adminEmail = required("DEVELOPMENT_ADMIN_EMAIL").toLowerCase();
  const contractorEmail = required("DEVELOPMENT_CONTRACTOR_EMAILS")
    .split(",")[0]!
    .trim()
    .toLowerCase();
  const password = required("DEVELOPMENT_QA_PASSWORD");

  const [adminClerk, contractorClerk] = await Promise.all([
    ensureUser({
      email: adminEmail,
      password,
      firstName: "Development",
      lastName: "Owner",
    }),
    ensureUser({
      email: contractorEmail,
      password,
      firstName: "Development",
      lastName: "Contractor",
    }),
  ]);

  const db = new PrismaClient();
  try {
    const marker = await db.appSetting.findUnique({ where: { key: "environmentName" } });
    if (marker?.value !== "development") {
      throw new Error("Refusing: database is not marked Development.");
    }
    const [admin, contractor] = await db.$transaction([
      db.adminUser.update({
        where: { email: adminEmail },
        data: { clerkUserId: adminClerk.id, role: "OWNER" },
      }),
      db.contractor.update({
        where: { email: contractorEmail },
        data: { clerkUserId: contractorClerk.id },
      }),
    ]);
    console.log(
      JSON.stringify({
        linked: true,
        admin: { id: admin.id, role: admin.role },
        contractor: { id: contractor.id, active: !contractor.deactivatedAt },
      }),
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});