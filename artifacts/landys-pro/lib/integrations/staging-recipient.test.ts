import { afterEach, describe, expect, it } from "vitest";
import { safeEmailRecipient, safeSmsRecipient } from "./staging-recipient";

const originalEnv = process.env;
afterEach(() => {
  process.env = originalEnv;
});

describe("notification recipient isolation", () => {
  it("leaves production recipients unchanged", () => {
    process.env = { ...originalEnv, LANDYS_ENV: "production" };
    expect(safeEmailRecipient("real@example.com")).toBe("real@example.com");
    expect(safeSmsRecipient("+14155550100")).toBe("+14155550100");
  });

  it("redirects every staging recipient to explicit safe overrides", () => {
    process.env = {
      ...originalEnv,
      LANDYS_ENV: "staging",
      STAGING_NOTIFICATION_EMAIL: "qa@example.com",
      STAGING_NOTIFICATION_PHONE: "+15005550006",
    };
    expect(safeEmailRecipient("real@example.com")).toBe("qa@example.com");
    expect(safeSmsRecipient("+14155550100")).toBe("+15005550006");
  });

  it("redirects every Development recipient to explicit safe overrides", () => {
    process.env = {
      ...originalEnv,
      LANDYS_ENV: "development",
      DEVELOPMENT_NOTIFICATION_EMAIL: "dev-qa@example.com",
      DEVELOPMENT_NOTIFICATION_PHONE: "+15005550007",
    };
    expect(safeEmailRecipient("real@example.com")).toBe("dev-qa@example.com");
    expect(safeSmsRecipient("+14155550100")).toBe("+15005550007");
  });

  it("fails closed in Development when an override is missing", () => {
    process.env = { ...originalEnv, LANDYS_ENV: "development" };
    delete process.env.DEVELOPMENT_NOTIFICATION_EMAIL;
    delete process.env.DEVELOPMENT_NOTIFICATION_PHONE;
    expect(() => safeEmailRecipient("real@example.com")).toThrow(/refusing/i);
    expect(() => safeSmsRecipient("+14155550100")).toThrow(/refusing/i);
  });

  it("fails closed in staging when an override is missing", () => {
    process.env = { ...originalEnv, LANDYS_ENV: "staging" };
    delete process.env.STAGING_NOTIFICATION_EMAIL;
    delete process.env.STAGING_NOTIFICATION_PHONE;
    expect(() => safeEmailRecipient("real@example.com")).toThrow(/refusing/i);
    expect(() => safeSmsRecipient("+14155550100")).toThrow(/refusing/i);
  });

  it("redirects every local recipient to LOCAL_NOTIFICATION overrides", () => {
    process.env = {
      ...originalEnv,
      LANDYS_ENV: "local",
      LOCAL_NOTIFICATION_EMAIL: "local-qa@localhost.test",
      LOCAL_NOTIFICATION_PHONE: "+15005550099",
    };
    expect(safeEmailRecipient("real@example.com")).toBe("local-qa@localhost.test");
    expect(safeSmsRecipient("+14155550100")).toBe("+15005550099");
  });

  it("fails closed in local when an override is missing", () => {
    process.env = { ...originalEnv, LANDYS_ENV: "local" };
    delete process.env.LOCAL_NOTIFICATION_EMAIL;
    delete process.env.LOCAL_NOTIFICATION_PHONE;
    expect(() => safeEmailRecipient("real@example.com")).toThrow(/LOCAL_NOTIFICATION_EMAIL/);
    expect(() => safeSmsRecipient("+14155550100")).toThrow(/LOCAL_NOTIFICATION_PHONE/);
  });
});
