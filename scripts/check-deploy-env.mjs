const production = process.argv.includes("--production");
const errors = [];

function value(name) {
  return process.env[name]?.trim();
}

function requireEnv(name, reason) {
  if (!value(name)) errors.push(`${name}: ${reason}`);
}

function requireBoolean(name) {
  const current = value(name);
  if (current !== "true" && current !== "false") {
    errors.push(`${name}: must be explicitly set to "true" or "false"`);
  }
}

requireEnv("DATABASE_URL", "pooled Supabase PostgreSQL connection is required");
requireEnv("DIRECT_URL", "direct Supabase connection is required for Prisma migrations");
requireEnv("NEXT_PUBLIC_APP_URL", "public deployment URL is required for links and redirects");

if (production) {
  if (value("AUTH_MODE") !== "clerk") {
    errors.push('AUTH_MODE: production requires the exact value "clerk"');
  }
  requireEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "Clerk publishable key is required");
  requireEnv("CLERK_SECRET_KEY", "Clerk secret key is required");
  requireEnv("ADMIN_EMAILS", "at least one production admin email is required");
  requireEnv("CRON_SECRET", "protects the lead-expiry endpoint");
  requireEnv("SUPABASE_URL", "required for persistent contractor logo storage");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only key required for persistent logo storage");

  const appUrl = value("NEXT_PUBLIC_APP_URL");
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (parsed.protocol !== "https:") {
        errors.push("NEXT_PUBLIC_APP_URL: production URL must use https");
      }
      if (["localhost", "127.0.0.1"].includes(parsed.hostname)) {
        errors.push("NEXT_PUBLIC_APP_URL: production URL cannot point to localhost");
      }
    } catch {
      errors.push("NEXT_PUBLIC_APP_URL: must be a valid absolute URL");
    }
  }
}

for (const flag of ["STRIPE_MOCK", "TWILIO_MOCK", "RESEND_MOCK"]) {
  requireBoolean(flag);
  if (production && value(flag) === "true") {
    errors.push(`${flag}: client-test deployment must use the live provider ("false")`);
  }
}

if (value("STRIPE_MOCK") === "false") {
  requireEnv("STRIPE_SECRET_KEY", "required when Stripe mock mode is disabled");
  requireEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "required when Stripe mock mode is disabled");
  requireEnv("STRIPE_WEBHOOK_SECRET", "required to verify Stripe webhooks");
}

if (value("TWILIO_MOCK") === "false") {
  requireEnv("TWILIO_ACCOUNT_SID", "required when Twilio mock mode is disabled");
  requireEnv("TWILIO_AUTH_TOKEN", "required when Twilio mock mode is disabled");
  if (
    !value("TWILIO_MESSAGING_SERVICE_SID") &&
    !value("TWILIO_FROM") &&
    !value("TWILIO_FROM_NUMBER")
  ) {
    errors.push("TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER: one sender is required");
  }
}

if (value("RESEND_MOCK") === "false") {
  requireEnv("RESEND_API_KEY", "required when Resend mock mode is disabled");
  if (!value("RESEND_FROM") && !value("RESEND_FROM_EMAIL")) {
    errors.push("RESEND_FROM: verified sender required when Resend mock mode is disabled");
  }
}

if (errors.length > 0) {
  console.error("\nDeployment environment is incomplete:\n");
  for (const error of errors) console.error(`  - ${error}`);
  console.error("\nAdd these values to Replit Secrets, then rebuild.\n");
  process.exit(1);
}

console.log("Deployment environment check passed.");
