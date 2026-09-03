/**
 * Idempotent Clerk TEST users for local Cursor QA.
 *
 *   pnpm local:clerk-qa
 *   (also invoked automatically by local:reseed / pnpm dev:reseed)
 *
 * Creates or updates two password users on the existing sk_test_ instance.
 * Never targets production Clerk (refuses non-sk_test_ keys).
 */
import { assertLocalSupabaseIsolation } from "../lib/ops/database-safety";

const DEFAULT_PASSWORD = "LandysLocalQA!2026";
const PREFERRED_ADMIN = "admin.qa+clerk_test@example.com";
const PREFERRED_CONTRACTOR = "contractor.qa+clerk_test@example.com";
const FALLBACK_ADMIN = "admin.qa@example.com";
const FALLBACK_CONTRACTOR = "contractor.qa@example.com";
const FALLBACK2_ADMIN = "admin.qa@landys.pro";
const FALLBACK2_CONTRACTOR = "contractor.qa@landys.pro";

type ClerkEmail = {
  id: string;
  email_address: string;
  verification?: { status?: string | null } | null;
};

type ClerkUser = {
  id: string;
  email_addresses?: ClerkEmail[];
};

function requireTestClerkKey(): string {
  const key = process.env.CLERK_SECRET_KEY?.trim();
  if (!key?.startsWith("sk_test_")) {
    throw new Error("Refusing: CLERK_SECRET_KEY must be a Clerk TEST key (sk_test_).");
  }
  return key;
}

export function qaPassword(): string {
  return process.env.LOCAL_QA_PASSWORD?.trim() || DEFAULT_PASSWORD;
}

async function clerkFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const key = requireTestClerkKey();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${key}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`https://api.clerk.com/v1${path}`, { ...init, headers });
}

async function findUserByEmail(email: string): Promise<ClerkUser | null> {
  const res = await clerkFetch(`/users?email_address=${encodeURIComponent(email)}&limit=1`);
  if (!res.ok) {
    throw new Error(`Clerk list users failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as ClerkUser[];
  return Array.isArray(data) && data[0] ? data[0] : null;
}

async function markEmailsVerified(user: ClerkUser): Promise<void> {
  for (const email of user.email_addresses ?? []) {
    if (email.verification?.status === "verified") continue;
    const patched = await clerkFetch(`/email_addresses/${email.id}`, {
      method: "PATCH",
      body: JSON.stringify({ verified: true }),
    });
    if (patched.ok) continue;
    const verify = await clerkFetch(`/email_addresses/${email.id}/verify`, {
      method: "POST",
      body: JSON.stringify({ strategy: "admin" }),
    });
    if (!verify.ok) {
      console.warn(`  warn: could not force-verify ${email.email_address} (${verify.status})`);
    }
  }
}

async function setPassword(userId: string, password: string): Promise<void> {
  const res = await clerkFetch(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      password,
      skip_password_checks: true,
      sign_out_of_other_sessions: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Clerk set password failed (${res.status}): ${await res.text()}`);
  }
}

async function createUser(
  email: string,
  password: string,
  name: { first: string; last: string },
): Promise<ClerkUser> {
  const res = await clerkFetch("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [email],
      password,
      first_name: name.first,
      last_name: name.last,
      skip_password_checks: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Clerk create user failed for ${email} (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as ClerkUser;
}

async function ensureUser(opts: {
  email: string;
  password: string;
  first: string;
  last: string;
}): Promise<{ user: ClerkUser; created: boolean }> {
  const existing = await findUserByEmail(opts.email);
  if (existing) {
    await setPassword(existing.id, opts.password);
    const freshRes = await clerkFetch(`/users/${existing.id}`);
    const fresh = (await freshRes.json()) as ClerkUser;
    await markEmailsVerified(fresh);
    return { user: fresh, created: false };
  }
  const created = await createUser(opts.email, opts.password, {
    first: opts.first,
    last: opts.last,
  });
  await markEmailsVerified(created);
  return { user: created, created: true };
}

async function preferPasswordSignIn(): Promise<void> {
  // Prefer password over email OTP when Device Trust / password is required.
  // Does not disable Device Trust (Dashboard-only); helps the password field appear.
  const res = await clerkFetch("/instance", {
    method: "PATCH",
    body: JSON.stringify({
      preferred_sign_in_strategy_when_password_required: "password",
    }),
  });
  if (!res.ok && res.status !== 204) {
    console.warn(`  warn: could not prefer password sign-in (${res.status})`);
  }
}

async function resolveEmailPair(): Promise<{ admin: string; contractor: string }> {
  const envAdmin = process.env.LOCAL_ADMIN_EMAIL?.trim();
  const envContractor = process.env.LOCAL_CONTRACTOR_EMAILS?.split(",")[0]?.trim();
  if (envAdmin?.includes("@") && envContractor?.includes("@")) {
    return { admin: envAdmin, contractor: envContractor };
  }

  const candidates: Array<{ admin: string; contractor: string; label: string }> = [
    { admin: PREFERRED_ADMIN, contractor: PREFERRED_CONTRACTOR, label: "Clerk test" },
    { admin: FALLBACK_ADMIN, contractor: FALLBACK_CONTRACTOR, label: "@example.com" },
    { admin: FALLBACK2_ADMIN, contractor: FALLBACK2_CONTRACTOR, label: "@landys.pro" },
  ];

  for (const pair of candidates) {
    const existing = await findUserByEmail(pair.admin);
    if (existing) return { admin: pair.admin, contractor: pair.contractor };

    const probe = await clerkFetch("/users", {
      method: "POST",
      body: JSON.stringify({
        email_address: [pair.admin],
        password: qaPassword(),
        first_name: "Admin",
        last_name: "QA",
        skip_password_checks: true,
      }),
    });
    if (probe.ok) {
      const user = (await probe.json()) as ClerkUser;
      await markEmailsVerified(user);
      if (pair.admin !== PREFERRED_ADMIN) {
        console.warn(`  Using ${pair.label} emails (Clerk rejected prior domains)`);
      }
      return { admin: pair.admin, contractor: pair.contractor };
    }

    const body = await probe.text();
    if (/form_identifier_exists|already.?exists|email_address_taken/i.test(body)) {
      return { admin: pair.admin, contractor: pair.contractor };
    }
    console.warn(`  ${pair.label} rejected (${probe.status}): ${body.slice(0, 160)}`);
  }

  throw new Error(
    "Clerk rejected all QA email domains (.local, @example.com, @landys.pro). Create the users in the Clerk Dashboard instead.",
  );
}

export type LocalClerkQaResult = {
  adminEmail: string;
  contractorEmail: string;
  password: string;
  adminUserId: string;
  contractorUserId: string;
};

export async function ensureLocalClerkQaUsers(): Promise<LocalClerkQaResult> {
  if (process.env.LANDYS_ENV !== "local") {
    throw new Error('Refusing: LANDYS_ENV must be exactly "local".');
  }
  requireTestClerkKey();

  const password = qaPassword();
  await preferPasswordSignIn();
  const emails = await resolveEmailPair();

  const admin = await ensureUser({
    email: emails.admin,
    password,
    first: "Admin",
    last: "QA",
  });
  const contractor = await ensureUser({
    email: emails.contractor,
    password,
    first: "Contractor",
    last: "QA",
  });

  // Publish into process.env so the subsequent local seed uses these addresses.
  process.env.LOCAL_ADMIN_EMAIL = emails.admin;
  process.env.LOCAL_CONTRACTOR_EMAILS = [
    emails.contractor,
    "contractor2@localhost.test",
    "contractor3@localhost.test",
    "contractor4@localhost.test",
  ].join(",");
  const existingAdmins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!existingAdmins.includes(emails.admin.toLowerCase())) {
    process.env.ADMIN_EMAILS = [emails.admin, ...existingAdmins].join(",");
  }

  return {
    adminEmail: emails.admin,
    contractorEmail: emails.contractor,
    password,
    adminUserId: admin.user.id,
    contractorUserId: contractor.user.id,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();
  const expectedProjectRef = process.env.LOCAL_SUPABASE_PROJECT_REF?.trim();
  if (databaseUrl && directUrl && expectedProjectRef) {
    assertLocalSupabaseIsolation({
      databaseUrl,
      directUrl,
      expectedProjectRef,
      supabaseUrl: process.env.SUPABASE_URL,
    });
  }

  const result = await ensureLocalClerkQaUsers();
  console.log("✓ Clerk TEST QA users ready (idempotent).");
  console.log(`  Admin: ${result.adminEmail} (${result.adminUserId})`);
  console.log(`  Contractor: ${result.contractorEmail} (${result.contractorUserId})`);
  console.log(`LOCAL_QA_PASSWORD=${result.password}`);
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/local-clerk-qa.ts");
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
