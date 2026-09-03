/** Hostnames known to be production — destructive local/staging scripts must refuse these. */
export const PRODUCTION_HOST_FINGERPRINTS = [
  "cole-prolandy-project.replit.app",
] as const;

/** Supabase projects that local reset/seed helpers must never target. */
export const PRODUCTION_SUPABASE_PROJECT_REFS = [
  "lifmdxzaytzotnfsaqtr",
] as const;

const DANGEROUS_DB_HOST_SNIPPETS = [
  "cole-prolandy",
  "prod",
  "production",
] as const;

export function looksLikeProductionHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (PRODUCTION_HOST_FINGERPRINTS.some((fp) => host === fp || host.endsWith(`.${fp}`))) {
    return true;
  }
  if (host.includes("staging")) return false;
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return false;
  return false;
}

export function assertNotProductionTarget(opts: {
  landysEnv: string;
  databaseUrl?: string | null;
  expectedSupabaseProjectRef?: string | null;
  publicUrl?: string | null;
  allowEnv?: Array<"local" | "staging" | "development">;
}): void {
  const env = String(opts.landysEnv).toLowerCase();
  if (env === "production") {
    throw new Error('Refusing: LANDYS_ENV=production. Destructive QA commands cannot target production.');
  }
  const allowed = opts.allowEnv ?? ["local", "staging", "development"];
  if (!allowed.includes(env as "local" | "staging" | "development")) {
    throw new Error(`Refusing: LANDYS_ENV="${env}" is not allowed for this command.`);
  }

  if (opts.publicUrl) {
    try {
      const host = new URL(opts.publicUrl).hostname;
      if (looksLikeProductionHostname(host)) {
        throw new Error(`Refusing: public URL host "${host}" looks like production.`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Refusing:")) throw e;
      throw new Error("Refusing: invalid public URL.");
    }
  }

  if (opts.databaseUrl) {
    assertDatabaseUrlSafeForQa(opts.databaseUrl, opts.expectedSupabaseProjectRef);
  }
}

function assertNotProductionProjectRef(projectRef: string | null, source: string): void {
  if (
    projectRef &&
    PRODUCTION_SUPABASE_PROJECT_REFS.includes(
      projectRef.toLowerCase() as (typeof PRODUCTION_SUPABASE_PROJECT_REFS)[number],
    )
  ) {
    throw new Error(`Refusing: ${source} targets the protected production Supabase project.`);
  }
}

export function supabaseProjectRefFromDatabaseUrl(databaseUrl: string): string | null {
  const parsed = new URL(databaseUrl);
  const host = parsed.hostname.toLowerCase();
  const direct = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
  if (direct) return direct;

  // Supavisor/pooler URLs use a shared hostname and put the project ref in
  // the username as postgres.<project-ref>.
  const username = decodeURIComponent(parsed.username).toLowerCase();
  return username.match(/^postgres\.([a-z0-9]+)$/)?.[1] ?? null;
}

export function supabaseProjectRefFromApiUrl(apiUrl: string): string | null {
  const host = new URL(apiUrl).hostname.toLowerCase();
  return host.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1] ?? null;
}

export function assertDatabaseUrlSafeForQa(
  databaseUrl: string,
  expectedSupabaseProjectRef?: string | null,
): void {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Refusing: DATABASE_URL is not a valid URL.");
  }

  const host = parsed.hostname.toLowerCase();
  const dbName = (parsed.pathname.replace(/^\//, "") || "").toLowerCase();
  const projectRef = supabaseProjectRefFromDatabaseUrl(databaseUrl);

  assertNotProductionProjectRef(projectRef, "database URL");
  if (expectedSupabaseProjectRef) {
    const expected = expectedSupabaseProjectRef.trim().toLowerCase();
    assertNotProductionProjectRef(expected, "LOCAL_SUPABASE_PROJECT_REF");
    if (!projectRef || projectRef !== expected) {
      throw new Error("Refusing: database URL does not match LOCAL_SUPABASE_PROJECT_REF.");
    }
  }

  if (PRODUCTION_HOST_FINGERPRINTS.some((fp) => host.includes(fp.replace(".replit.app", "")))) {
    throw new Error(`Refusing: database host "${host}" matches a production fingerprint.`);
  }

  // A loopback-only database is non-production by definition.
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return;

  // Remote Supabase is allowed only when its project ref can be extracted and
  // is not on the hard-coded production denylist above.
  if (host.endsWith(".supabase.com") || host.endsWith(".supabase.co")) {
    if (!projectRef) {
      throw new Error("Refusing: could not extract a Supabase project ref from database URL.");
    }
    return;
  }

  // Explicit local/dev naming in the database name is preferred for remote non-prod DBs.
  const localMarkers = ["local", "dev", "development", "staging", "qa", "test"];
  const hasLocalMarker =
    localMarkers.some((m) => dbName.includes(m)) ||
    localMarkers.some((m) => host.includes(m)) ||
    host.endsWith(".local");

  if (!hasLocalMarker) {
    // Remote hosts without an explicit non-prod marker are refused.
    throw new Error(
      `Refusing: database "${host}/${dbName || "(default)"}" has no local/staging/qa marker. ` +
        "Use a loopback database or a dedicated non-production database whose name/host includes local|dev|staging|qa|test.",
    );
  }

  // Extra caution: refuse hosts that scream production even with a marker typo.
  if (DANGEROUS_DB_HOST_SNIPPETS.some((s) => host.includes(s) && !host.includes("staging"))) {
    if (host.includes("prod") || host.includes("production")) {
      throw new Error(`Refusing: database host "${host}" appears production-related.`);
    }
  }
}

export function assertLocalSupabaseIsolation(opts: {
  databaseUrl: string;
  directUrl: string;
  expectedProjectRef: string;
  supabaseUrl?: string | null;
}): string {
  const expected = opts.expectedProjectRef.trim().toLowerCase();
  if (!expected) throw new Error("Refusing: LOCAL_SUPABASE_PROJECT_REF is required.");
  assertNotProductionProjectRef(expected, "LOCAL_SUPABASE_PROJECT_REF");

  assertDatabaseUrlSafeForQa(opts.databaseUrl, expected);
  assertDatabaseUrlSafeForQa(opts.directUrl, expected);
  const runtimeRef = supabaseProjectRefFromDatabaseUrl(opts.databaseUrl);
  const directRef = supabaseProjectRefFromDatabaseUrl(opts.directUrl);
  if (!runtimeRef || runtimeRef !== directRef) {
    throw new Error("Refusing: DATABASE_URL and DIRECT_URL do not target the same Supabase project.");
  }

  if (opts.supabaseUrl?.trim()) {
    let storageRef: string | null;
    try {
      storageRef = supabaseProjectRefFromApiUrl(opts.supabaseUrl);
    } catch {
      throw new Error("Refusing: SUPABASE_URL is invalid.");
    }
    assertNotProductionProjectRef(storageRef, "SUPABASE_URL");
    if (storageRef !== expected) {
      throw new Error("Refusing: SUPABASE_URL does not match the local DEV database project.");
    }
  }

  return expected;
}

/** Playwright / browser E2E must never mutate production. */
export function assertBrowserTargetSafe(baseUrl: string): void {
  const url = new URL(baseUrl);
  if (looksLikeProductionHostname(url.hostname)) {
    throw new Error(`Refusing browser QA against production host: ${url.hostname}`);
  }
  if (url.hostname.includes("cole-prolandy") && !url.hostname.includes("staging")) {
    throw new Error(`Refusing browser QA against production-like host: ${url.hostname}`);
  }
}
