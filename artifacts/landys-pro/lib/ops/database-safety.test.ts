import { afterEach, describe, expect, it } from "vitest";
import {
  assertBrowserTargetSafe,
  assertDatabaseUrlSafeForQa,
  assertLocalSupabaseIsolation,
  assertNotProductionTarget,
  looksLikeProductionHostname,
  supabaseProjectRefFromDatabaseUrl,
} from "./database-safety";

const originalEnv = process.env;
afterEach(() => {
  process.env = originalEnv;
});

describe("database-safety", () => {
  it("recognizes the production Replit host", () => {
    expect(looksLikeProductionHostname("cole-prolandy-project.replit.app")).toBe(true);
    expect(looksLikeProductionHostname("localhost")).toBe(false);
  });

  it("allows loopback database URLs", () => {
    expect(() =>
      assertDatabaseUrlSafeForQa("postgresql://landys:landys_local@localhost:5433/landys_local"),
    ).not.toThrow();
  });

  it("refuses a Supabase database that does not match the explicit DEV ref", () => {
    expect(() =>
      assertDatabaseUrlSafeForQa(
        "postgresql://u:p@db.abcdef.supabase.co:5432/postgres",
        "differentproject",
      ),
    ).toThrow(/does not match/i);
  });

  it("extracts Supabase refs from direct and pooled URLs", () => {
    expect(
      supabaseProjectRefFromDatabaseUrl(
        "postgresql://postgres.devproject:p@aws-0-us-east-2.pooler.supabase.com:6543/postgres",
      ),
    ).toBe("devproject");
    expect(
      supabaseProjectRefFromDatabaseUrl(
        "postgresql://postgres:p@db.devproject.supabase.co:5432/postgres",
      ),
    ).toBe("devproject");
  });

  it("hard-blocks the production Supabase project on every database URL shape", () => {
    expect(() =>
      assertDatabaseUrlSafeForQa(
        "postgresql://postgres.lifmdxzaytzotnfsaqtr:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
        "lifmdxzaytzotnfsaqtr",
      ),
    ).toThrow(/production/i);
    expect(() =>
      assertDatabaseUrlSafeForQa(
        "postgresql://postgres:p@db.lifmdxzaytzotnfsaqtr.supabase.co:5432/postgres",
      ),
    ).toThrow(/production/i);
  });

  it("requires runtime, direct, and Storage URLs to share the explicit DEV ref", () => {
    expect(() =>
      assertLocalSupabaseIsolation({
        databaseUrl:
          "postgresql://postgres.devproject:p@aws-0-us-east-2.pooler.supabase.com:6543/postgres",
        directUrl:
          "postgresql://postgres.devproject:p@aws-0-us-east-2.pooler.supabase.com:5432/postgres",
        expectedProjectRef: "devproject",
        supabaseUrl: "https://devproject.supabase.co",
      }),
    ).not.toThrow();
    expect(() =>
      assertLocalSupabaseIsolation({
        databaseUrl:
          "postgresql://postgres.devproject:p@aws-0-us-east-2.pooler.supabase.com:6543/postgres",
        directUrl:
          "postgresql://postgres.otherproject:p@aws-0-us-east-2.pooler.supabase.com:5432/postgres",
        expectedProjectRef: "devproject",
      }),
    ).toThrow(/does not match/i);
  });

  it("refuses LANDYS_ENV=production for destructive targets", () => {
    expect(() =>
      assertNotProductionTarget({
        landysEnv: "production",
        databaseUrl: "postgresql://landys:x@localhost:5433/landys_local",
      }),
    ).toThrow(/production/i);
  });

  it("refuses browser QA against production hostname", () => {
    expect(() => assertBrowserTargetSafe("https://cole-prolandy-project.replit.app")).toThrow(
      /production/i,
    );
    expect(() => assertBrowserTargetSafe("http://localhost:3000")).not.toThrow();
  });
});
