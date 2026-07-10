import { describe, it, expect, afterEach, vi } from "vitest";

// lib/auth imports the prisma singleton and Clerk at module load; stub them so
// the fail-closed config guard can be tested in isolation.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  clerkClient: vi.fn(),
}));

import {
  assertAuthConfigFailClosed,
  authMode,
  parseAdminEmails,
  collectAllEmails,
  userIsAdmin,
} from "./auth";

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

describe("parseAdminEmails", () => {
  it("splits, trims, and lowercases", () => {
    expect(parseAdminEmails("A@X.com, b@Y.com")).toEqual(["a@x.com", "b@y.com"]);
  });

  it("strips wrapping quotes on the whole value and per email", () => {
    expect(parseAdminEmails('"a@x.com,b@y.com"')).toEqual(["a@x.com", "b@y.com"]);
    expect(parseAdminEmails("'a@x.com', \"b@y.com\"")).toEqual(["a@x.com", "b@y.com"]);
  });

  it("drops empty / non-email tokens", () => {
    expect(parseAdminEmails("a@x.com,, ,not-an-email")).toEqual(["a@x.com"]);
  });
});

describe("userIsAdmin / collectAllEmails", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("matches any Clerk email against ADMIN_EMAILS, not only primary", () => {
    vi.stubEnv("ADMIN_EMAILS", "masdouk@techma.ca");
    const user = {
      primaryEmailAddress: { emailAddress: "other@example.com" },
      emailAddresses: [
        { emailAddress: "other@example.com" },
        { emailAddress: "Masdouk@techma.ca" },
      ],
    };
    expect(collectAllEmails(user)).toEqual(["other@example.com", "masdouk@techma.ca"]);
    expect(userIsAdmin(user)).toBe(true);
  });

  it("honors publicMetadata.role=admin even without ADMIN_EMAILS match", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(
      userIsAdmin({
        primaryEmailAddress: { emailAddress: "x@y.com" },
        publicMetadata: { role: "admin" },
      }),
    ).toBe(true);
  });

  it("returns false for contractors", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@landys.pro");
    expect(
      userIsAdmin({
        primaryEmailAddress: { emailAddress: "bigsky@example.com" },
        emailAddresses: [{ emailAddress: "bigsky@example.com" }],
      }),
    ).toBe(false);
  });
});
