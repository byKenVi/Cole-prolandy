/**
 * Minimal in-memory Prisma-shaped fake for unit-testing the money + lead domain
 * logic without a real database. Implements only the query surface the domain
 * functions use. Not a general Prisma replacement.
 */
import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;

let counter = 0;
const id = (prefix: string) => `${prefix}_${counter++}_${randomUUID().slice(0, 8)}`;

function matchWhere(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "id" && cond && typeof cond === "object" && "notIn" in cond) {
      const notIn = (cond as { notIn: unknown[] }).notIn;
      if (notIn.includes(row.id)) return false;
      continue;
    }
    if (key === "leadId" && cond && typeof cond === "object" && "in" in cond) {
      if (!(cond as { in: unknown[] }).in.includes(row.leadId)) return false;
      continue;
    }
    if (key === "id" && cond && typeof cond === "object" && "in" in cond) {
      if (!(cond as { in: unknown[] }).in.includes(row.id)) return false;
      continue;
    }
    if (key === "status" && cond && typeof cond === "object" && "in" in cond) {
      if (!(cond as { in: unknown[] }).in.includes(row.status)) return false;
      continue;
    }
    if (
      key === "walletBalanceCents" &&
      cond &&
      typeof cond === "object" &&
      "gte" in cond
    ) {
      if ((row.walletBalanceCents as number) < (cond as { gte: number }).gte)
        return false;
      continue;
    }
    if (
      key === "expiresAt" &&
      cond &&
      typeof cond === "object" &&
      "lt" in cond
    ) {
      if ((row.expiresAt as Date).getTime() >= (cond as { lt: Date }).lt.getTime())
        return false;
      continue;
    }
    // plain equality
    if (row[key] !== cond) return false;
  }
  return true;
}

function applyData(row: Row, data: Row): void {
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === "object" && "increment" in val) {
      row[key] = (row[key] as number) + (val as { increment: number }).increment;
    } else {
      row[key] = val;
    }
  }
}

// Unique constraints enforced by the fake, keyed by table prefix. Mirrors the
// real schema so idempotency guards (Stripe event id, payment intent) can be
// tested. Only non-null values conflict (Postgres treats NULLs as distinct).
const UNIQUE_FIELDS: Record<string, string[]> = {
  contractor: ["email", "clerkUserId"],
  wallettx: ["stripePaymentIntentId"],
  processedstripeevent: ["id"],
};

class Table {
  rows: Row[] = [];
  constructor(private prefix: string) {}

  seed(rows: Row[]) {
    this.rows.push(...rows.map((r) => ({ ...r })));
  }

  async create({ data, select }: { data: Row; select?: Row }) {
    const row: Row = { id: data.id ?? id(this.prefix), ...data };
    if (row.acceptToken === undefined && this.prefix === "leadmatch") {
      row.acceptToken = id("tok");
    }
    if (row.createdAt === undefined) row.createdAt = new Date();

    for (const field of UNIQUE_FIELDS[this.prefix] ?? []) {
      const value = row[field];
      if (value !== null && value !== undefined && this.rows.some((r) => r[field] === value)) {
        const err = new Error(
          `Unique constraint failed on the fields: (\`${field}\`)`,
        ) as Error & { code?: string };
        err.code = "P2002";
        throw err;
      }
    }

    this.rows.push(row);
    return project(row, select);
  }

  async findUnique({ where, select, include }: { where: Row; select?: Row; include?: Row }) {
    const row = this.rows.find((r) => matchesUnique(r, where));
    if (!row) return null;
    return hydrate(project(row, select), row, include);
  }

  async findFirst({
    where,
    select,
    orderBy,
  }: {
    where?: Row;
    select?: Row;
    orderBy?: Row;
  }) {
    const many = await this.findMany({ where, select, orderBy });
    return many[0] ?? null;
  }

  async findMany({
    where,
    select,
    orderBy,
    take,
  }: {
    where?: Row;
    select?: Row;
    orderBy?: Row;
    take?: number;
  }) {
    let out = this.rows.filter((r) => matchWhere(r, where));
    if (orderBy) {
      const [field, dir] = Object.entries(orderBy)[0] as [string, string];
      out = out.slice().sort((a, b) => {
        const av = a[field] as number | string | Date;
        const bv = b[field] as number | string | Date;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return dir === "desc" ? -cmp : cmp;
      });
    }
    if (typeof take === "number") out = out.slice(0, take);
    return out.map((r) => project(r, select));
  }

  async update({ where, data }: { where: Row; data: Row }) {
    const row = this.rows.find((r) => matchesUnique(r, where));
    if (!row) throw new Error("Record to update not found");
    applyData(row, data);
    return { ...row };
  }

  async updateMany({ where, data }: { where?: Row; data: Row }) {
    const matched = this.rows.filter((r) => matchWhere(r, where));
    matched.forEach((r) => applyData(r, data));
    return { count: matched.length };
  }
}

function matchesUnique(row: Row, where: Row): boolean {
  // Supports { id }, { acceptToken }, { key }, and the composite PriceTier key.
  if ("contractorTypeId_projectTypeId_tier" in where) {
    const c = where.contractorTypeId_projectTypeId_tier as Row;
    return (
      row.contractorTypeId === c.contractorTypeId &&
      row.projectTypeId === c.projectTypeId &&
      row.tier === c.tier
    );
  }
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

function project(row: Row, select?: Row): Row {
  if (!select) return { ...row };
  const out: Row = {};
  for (const key of Object.keys(select)) out[key] = row[key];
  return out;
}

function hydrate(base: Row, row: Row, include?: Row): Row {
  if (!include) return base;
  const out = { ...base };
  const db = currentDb;
  if (!db) return out;
  if (include.projectType && row.projectTypeId) {
    out.projectType = db.projectType.rows.find((p) => p.id === row.projectTypeId);
  }
  if (include.matches && row.id) {
    out.matches = db.leadMatch.rows.filter((m) => m.leadId === row.id);
  }
  if (include.lead && row.leadId) {
    out.lead = db.lead.rows.find((l) => l.id === row.leadId);
  }
  if (include.walletTransactions && row.id) {
    out.walletTransactions = db.walletTransaction.rows.filter(
      (t) => t.leadMatchId === row.id,
    );
  }
  return out;
}

let currentDb: FakeDb | null = null;

export class FakeDb {
  contractor = new Table("contractor");
  contractorType = new Table("contractortype");
  projectType = new Table("projecttype");
  lead = new Table("lead");
  leadMatch = new Table("leadmatch");
  walletTransaction = new Table("wallettx");
  priceTier = new Table("pricetier");
  appSetting = new Table("appsetting");
  auditLog = new Table("audit");
  processedStripeEvent = new Table("processedstripeevent");

  constructor() {
    currentDb = this;
    this.appSetting.seed([
      { key: "maxLeadRecipients", value: "3" },
      { key: "leadExpiryHours", value: "48" },
      { key: "defaultLeadTier", value: "2" },
    ]);
  }

  private tables(): Table[] {
    return [
      this.contractor,
      this.contractorType,
      this.projectType,
      this.lead,
      this.leadMatch,
      this.walletTransaction,
      this.priceTier,
      this.appSetting,
      this.auditLog,
      this.processedStripeEvent,
    ];
  }

  // Interactive transaction with rollback-on-throw, mirroring Postgres: if the
  // callback throws, all writes made inside are reverted. Critical for testing
  // the accept path, where a failed charge must roll back the status claim.
  async $transaction<T>(fn: (tx: FakeDb) => Promise<T>): Promise<T> {
    const snapshot = this.tables().map((t) => t.rows.map((r) => ({ ...r })));
    try {
      return await fn(this);
    } catch (e) {
      this.tables().forEach((t, i) => {
        t.rows = snapshot[i];
      });
      throw e;
    }
  }
}

export function createFakeDb(): FakeDb {
  const db = new FakeDb();
  currentDb = db;
  return db;
}
