import { afterEach, describe, expect, it } from "vitest";
import {
  assertLocalRuntimeConfig,
  assertStagingRuntimeConfig,
  landysEnvironment,
} from "./runtime-environment";

const originalEnv = process.env;
afterEach(() => {
  process.env = originalEnv;
});

describe("runtime configuration", () => {
  it("does not change production runtime behavior", () => {
    process.env = { ...originalEnv, LANDYS_ENV: "production" };
    expect(landysEnvironment()).toBe("production");
    expect(() => assertStagingRuntimeConfig()).not.toThrow();
    expect(() => assertLocalRuntimeConfig()).not.toThrow();
  });

  it("accepts local env on localhost", () => {
    process.env = {
      ...originalEnv,
      LANDYS_ENV: "local",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      AUTH_MODE: "dev",
      STRIPE_MOCK: "true",
      DATABASE_URL:
        "postgresql://postgres.devproject:p@aws-0-us-east-2.pooler.supabase.com:6543/postgres",
      DIRECT_URL:
        "postgresql://postgres.devproject:p@aws-0-us-east-2.pooler.supabase.com:5432/postgres",
      LOCAL_SUPABASE_PROJECT_REF: "devproject",
      SUPABASE_URL: "https://devproject.supabase.co",
      LOCAL_NOTIFICATION_EMAIL: "qa@localhost.test",
      LOCAL_NOTIFICATION_PHONE: "+15005550006",
    };
    expect(landysEnvironment()).toBe("local");
    expect(() => assertLocalRuntimeConfig()).not.toThrow();
  });

  it("rejects the protected production Supabase project in local mode", () => {
    process.env = {
      ...originalEnv,
      LANDYS_ENV: "local",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      AUTH_MODE: "dev",
      STRIPE_MOCK: "true",
      DATABASE_URL:
        "postgresql://postgres.lifmdxzaytzotnfsaqtr:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
      DIRECT_URL:
        "postgresql://postgres.lifmdxzaytzotnfsaqtr:p@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
      LOCAL_SUPABASE_PROJECT_REF: "lifmdxzaytzotnfsaqtr",
      LOCAL_NOTIFICATION_EMAIL: "qa@localhost.test",
      LOCAL_NOTIFICATION_PHONE: "+15005550006",
    };
    expect(() => assertLocalRuntimeConfig()).toThrow(/production/i);
  });

  it("rejects local env pointed at a remote public URL", () => {
    process.env = {
      ...originalEnv,
      LANDYS_ENV: "local",
      NEXT_PUBLIC_APP_URL: "https://cole-prolandy-project.replit.app",
    };
    expect(() => assertLocalRuntimeConfig()).toThrow(/localhost/);
  });

  it("accepts staging with test auth and a clearly staging URL", () => {
    process.env = {
      ...originalEnv,
      LANDYS_ENV: "staging",
      STAGING_PUBLIC_URL: "https://landys-pro-staging.example.replit.app",
      NEXT_PUBLIC_APP_URL: "https://landys-pro-staging.example.replit.app",
      AUTH_MODE: "clerk",
      CLERK_PUBLISHABLE_KEY: "pk_test_example",
      CLERK_SECRET_KEY: "sk_test_example",
      STRIPE_MOCK: "false",
      STRIPE_SECRET_KEY: "sk_test_example",
      WIX_ESTIMATE_INTEGRATION_ENABLED: "true",
      WIX_ESTIMATE_API_SECRET: "staging-secret-present",
    };
    expect(() => assertStagingRuntimeConfig()).not.toThrow();
  });

  it("rejects live Clerk or Stripe credentials in staging", () => {
    process.env = {
      ...originalEnv,
      LANDYS_ENV: "staging",
      STAGING_PUBLIC_URL: "https://landys-pro-staging.example.replit.app",
      NEXT_PUBLIC_APP_URL: "https://landys-pro-staging.example.replit.app",
      AUTH_MODE: "clerk",
      CLERK_PUBLISHABLE_KEY: "pk_live_example",
      CLERK_SECRET_KEY: "sk_live_example",
      STRIPE_MOCK: "false",
      STRIPE_SECRET_KEY: "sk_live_example",
    };
    expect(() => assertStagingRuntimeConfig()).toThrow(/Clerk test/);
  });

  it("rejects the production URL pattern for staging", () => {
    process.env = {
      ...originalEnv,
      LANDYS_ENV: "staging",
      STAGING_PUBLIC_URL: "https://cole-prolandy-project.replit.app",
    };
    expect(() => assertStagingRuntimeConfig()).toThrow(/contain 'staging'/);
  });
});
