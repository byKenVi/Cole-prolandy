/**
 * Authenticated route smoke using Clerk sign-in tokens + password API check.
 * Does not bypass Clerk — tokens are issued by the Clerk TEST Backend API.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
const PASSWORD = process.env.LOCAL_QA_PASSWORD?.trim() || "LandysLocalQA!2026";
const ADMIN = process.env.LOCAL_ADMIN_EMAIL?.trim() || "admin.qa@example.com";
const CONTRACTOR =
  process.env.LOCAL_CONTRACTOR_EMAILS?.split(",")[0]?.trim() || "contractor.qa@example.com";
const SK = process.env.CLERK_SECRET_KEY!.trim();

async function clerkJson(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SK}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function userIdForEmail(email: string): Promise<string> {
  const { ok, body } = await clerkJson(
    `/users?email_address=${encodeURIComponent(email)}&limit=1`,
  );
  if (!ok || !Array.isArray(body) || !body[0]?.id) {
    throw new Error(`Clerk user missing for ${email}`);
  }
  return body[0].id as string;
}

async function passwordOk(email: string): Promise<boolean> {
  const id = await userIdForEmail(email);
  const { ok, body } = await clerkJson(`/users/${id}/verify_password`, {
    method: "POST",
    body: JSON.stringify({ password: PASSWORD }),
  });
  return ok && Boolean((body as { verified?: boolean })?.verified);
}

async function signInWithTicket(email: string): Promise<{
  ok: boolean;
  finalUrl: string;
  passwordApi: boolean;
  detail?: string;
  role: "admin" | "contractor";
}> {
  const role = email === ADMIN ? "admin" : "contractor";
  const passwordApi = await passwordOk(email);
  const userId = await userIdForEmail(email);
  const tokenRes = await clerkJson("/sign_in_tokens", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 600 }),
  });
  if (!tokenRes.ok) {
    return {
      ok: false,
      finalUrl: "",
      passwordApi,
      role,
      detail: `token create failed: ${JSON.stringify(tokenRes.body)}`,
    };
  }
  const token = (tokenRes.body as { token: string }).token;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(token)}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });

    // Wait until Clerk consumes the ticket and post-auth routes the user.
    await page.waitForURL(
      (url) => {
        const p = url.pathname;
        return (
          p.startsWith("/admin") ||
          p.startsWith("/dashboard") ||
          p.startsWith("/home") ||
          p.startsWith("/profile") ||
          p.startsWith("/opportunities") ||
          p.startsWith("/jobs")
        );
      },
      { timeout: 180_000 },
    );

    const targetRoutes =
      role === "admin"
        ? [
            "/admin",
            "/admin/leads",
            "/admin/contractors",
            "/admin/fees",
            "/admin/confirmations",
            "/admin/settings",
          ]
        : ["/dashboard", "/opportunities", "/jobs", "/fees", "/profile"];

    for (const route of targetRoutes) {
      const res = await page.goto(`${BASE}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 180_000,
      });
      const status = res?.status() ?? 0;
      const path = new URL(page.url()).pathname;
      if (status >= 500 || path.startsWith("/sign-in")) {
        return {
          ok: false,
          finalUrl: page.url(),
          passwordApi,
          role,
          detail: `${route} status=${status} path=${path}`,
        };
      }
      if (role === "admin" && !path.startsWith("/admin")) {
        return {
          ok: false,
          finalUrl: page.url(),
          passwordApi,
          role,
          detail: `${route} redirected to ${path}`,
        };
      }
      if (role === "contractor" && path.startsWith("/admin")) {
        return {
          ok: false,
          finalUrl: page.url(),
          passwordApi,
          role,
          detail: `contractor landed on admin via ${route}`,
        };
      }
    }

    return { ok: true, finalUrl: page.url(), passwordApi, role };
  } catch (error) {
    return {
      ok: false,
      finalUrl: page.url(),
      passwordApi,
      role,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const admin = await signInWithTicket(ADMIN);
  const contractor = await signInWithTicket(CONTRACTOR);
  console.log(
    JSON.stringify(
      {
        adminEmail: ADMIN,
        contractorEmail: CONTRACTOR,
        adminLogin: admin.ok && admin.passwordApi ? "PASS" : "FAIL",
        adminDetail: admin,
        contractorLogin: contractor.ok && contractor.passwordApi ? "PASS" : "FAIL",
        contractorDetail: contractor,
      },
      null,
      2,
    ),
  );
  if (!(admin.ok && admin.passwordApi && contractor.ok && contractor.passwordApi)) {
    process.exitCode = 1;
  }
}

main();
