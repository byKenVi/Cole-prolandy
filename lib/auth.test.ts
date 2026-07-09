import { describe, it, expect, afterEach, vi } from "vitest";

// lib/auth imports the prisma singleton and Clerk at module load; stub them so
// the fail-closed config guard can be tested in isolation.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), currentUser: vi.fn() }));

import { assertAuthConfigFailClosed, authMode } from "./auth";

describe("assertAuthConfigFailClosed (prod fail-closed)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("throws in production when AUTH_MODE is not clerk", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_MODE", "dev");
    expect(() => assertAuthConfigFailClosed()).toThrow(/AUTH_MODE must be "clerk"/);
  });

  it("throws in production when AUTH_MODE is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_MODE", "");
    expect(() => assertAuthConfigFailClosed()).toThrow();
  });

  it("passes in production when AUTH_MODE is clerk", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_MODE", "clerk");
    expect(() => assertAuthConfigFailClosed()).not.toThrow();
  });

  it("passes in development regardless of AUTH_MODE (dev unchanged)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_MODE", "dev");
    expect(() => assertAuthConfigFailClosed()).not.toThrow();
    expect(authMode()).toBe("dev");
  });
});
