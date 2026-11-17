import type { DbClient } from "@/lib/domain/types";
import {
  LIVE_V3_CATEGORY_NAMES,
  LIVE_V3_LAND_TYPE_NAMES,
  LIVE_V3_WORK_TYPE_NAMES,
  normalizeLiveCategoryCode,
  normalizeLiveLandTypeCode,
  normalizeLiveWorkTypeCode,
} from "@/lib/taxonomy/live-v3";

/**
 * landys.co is the source of truth for taxonomy. Instead of rejecting values
 * we do not know, every category / work type / land type label that arrives
 * (estimate payloads or the contractor CMS) resolves to a stable slug code and
 * is created on first sight. "Roofing", "roofing" and "ROOFING" all land on
 * code `roofing`; "Land Lenders" and "land-lenders" on `land-lenders`.
 */

export type TaxonomyRef = { id: string; code: string; name: string; created: boolean };

/** AppSetting holding admin category merges: { "<old code>": "<target code>" }. */
export const CATEGORY_ALIASES_KEY = "categoryAliases";

export async function loadCategoryAliases(db: DbClient): Promise<Record<string, string>> {
  const row = await db.appSetting.findUnique({ where: { key: CATEGORY_ALIASES_KEY } });
  if (!row?.value) return {};
  try {
    const parsed = JSON.parse(row.value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** "Dirt Work & Excavation" → "dirt-work-excavation". */
export function slugifyTaxonomy(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** "land-lenders" → "Land Lenders"; "Kitchen & Bath" stays as typed. */
export function humanizeTaxonomy(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  const looksLikeSlug = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(trimmed);
  if (!looksLikeSlug) return trimmed.slice(0, 120);
  return trimmed
    .split(/[-_]+/)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ")
    .slice(0, 120);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

type Kind = "category" | "workType" | "landType";

function resolveCodeAndName(kind: Kind, raw: string): { code: string; name: string } | null {
  const input = raw.trim();
  if (!input) return null;
  const known =
    kind === "category"
      ? normalizeLiveCategoryCode(input)
      : kind === "workType"
        ? normalizeLiveWorkTypeCode(input)
        : normalizeLiveLandTypeCode(input);
  const names =
    kind === "category"
      ? LIVE_V3_CATEGORY_NAMES
      : kind === "workType"
        ? LIVE_V3_WORK_TYPE_NAMES
        : LIVE_V3_LAND_TYPE_NAMES;
  const code = known ?? slugifyTaxonomy(input);
  if (!code) return null;
  return { code, name: names.get(code) ?? humanizeTaxonomy(input) };
}

export async function ensureCategory(db: DbClient, raw: string | null | undefined): Promise<TaxonomyRef | null> {
  const resolved = raw ? resolveCodeAndName("category", raw) : null;
  if (!resolved) return null;
  // A category merged by an admin keeps routing to its target.
  const aliases = await loadCategoryAliases(db);
  const target = aliases[resolved.code];
  if (target) {
    const merged = await db.contractorCategory.findUnique({
      where: { code: target },
      select: { id: true, code: true, name: true },
    });
    if (merged) return { ...merged, created: false };
  }
  const existing = await db.contractorCategory.findUnique({
    where: { code: resolved.code },
    select: { id: true, code: true, name: true },
  });
  if (existing) return { ...existing, created: false };
  try {
    const created = await db.contractorCategory.create({
      data: { code: resolved.code, name: resolved.name, isActiveForNewIntake: true },
      select: { id: true, code: true, name: true },
    });
    return { ...created, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const clash = await db.contractorCategory.findFirst({
      where: { OR: [{ code: resolved.code }, { name: { equals: resolved.name, mode: "insensitive" } }] },
      select: { id: true, code: true, name: true },
    });
    return clash ? { ...clash, created: false } : null;
  }
}

/**
 * The first EXISTING category among several spellings (admin merges honoured).
 * Never creates one: an inferred category nobody belongs to would only hide
 * the request from the admins who can route it by hand.
 */
export async function findExistingCategory(
  db: DbClient,
  candidates: readonly string[],
): Promise<TaxonomyRef | null> {
  if (candidates.length === 0) return null;
  const aliases = await loadCategoryAliases(db);
  for (const name of candidates) {
    const code = slugifyTaxonomy(name);
    if (!code) continue;
    const row = await db.contractorCategory.findUnique({
      where: { code: aliases[code] ?? code },
      select: { id: true, code: true, name: true },
    });
    if (row) return { ...row, created: false };
  }
  const byName = await db.contractorCategory.findFirst({
    where: { name: { in: [...candidates], mode: "insensitive" } },
    select: { id: true, code: true, name: true },
  });
  return byName ? { ...byName, created: false } : null;
}

export async function ensureWorkType(db: DbClient, raw: string | null | undefined): Promise<TaxonomyRef | null> {
  const resolved = raw ? resolveCodeAndName("workType", raw) : null;
  if (!resolved) return null;
  const existing = await db.workType.findUnique({
    where: { code: resolved.code },
    select: { id: true, code: true, name: true },
  });
  if (existing) return { ...existing, created: false };
  try {
    const created = await db.workType.create({
      data: { code: resolved.code, name: resolved.name, isActiveForNewIntake: true },
      select: { id: true, code: true, name: true },
    });
    return { ...created, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const clash = await db.workType.findFirst({
      where: { OR: [{ code: resolved.code }, { name: { equals: resolved.name, mode: "insensitive" } }] },
      select: { id: true, code: true, name: true },
    });
    return clash ? { ...clash, created: false } : null;
  }
}

export async function ensureLandType(db: DbClient, raw: string | null | undefined): Promise<TaxonomyRef | null> {
  const resolved = raw ? resolveCodeAndName("landType", raw) : null;
  if (!resolved) return null;
  const existing = await db.landType.findUnique({
    where: { code: resolved.code },
    select: { id: true, code: true, name: true },
  });
  if (existing) return { ...existing, created: false };
  try {
    const created = await db.landType.create({
      data: { code: resolved.code, name: resolved.name, isActiveForNewIntake: true },
      select: { id: true, code: true, name: true },
    });
    return { ...created, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const clash = await db.landType.findFirst({
      where: { OR: [{ code: resolved.code }, { name: { equals: resolved.name, mode: "insensitive" } }] },
      select: { id: true, code: true, name: true },
    });
    return clash ? { ...clash, created: false } : null;
  }
}
