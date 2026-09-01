import { afterEach, describe, expect, it } from "vitest";
import { assertStagingRuntimeConfig, landysEnvironment } from "./runtime-environment";

const originalEnv = process.env;
afterEach(() => {
  process.env = originalEnv;
});

describe("staging runtime configuration", () => {
  it("does not change production runtime behavior", () => {
    process.env = { ...originalEnv, LANDYS_ENV: "production" };
    expect(landysEnvironment()).toBe("production");
    expect(() => assertStagingRuntimeConfig()).not.toThrow();
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