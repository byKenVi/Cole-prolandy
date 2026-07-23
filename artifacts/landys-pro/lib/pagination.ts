/** Default page size for list screens. */
export const DEFAULT_PAGE_SIZE = 10;

export function parsePage(raw: string | string[] | undefined, fallback = 1): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function parsePageSize(
  raw: string | string[] | undefined,
  fallback: number = DEFAULT_PAGE_SIZE,
  allowed: number[] = [10, 20, 50],
): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || !allowed.includes(n)) return fallback;
  return n;
}

export function paginationMeta(totalCount: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const skip = (safePage - 1) * pageSize;
  return { totalPages, page: safePage, skip, take: pageSize };
}

/** Build a query string, dropping empty values and optionally a page key when page is 1. */
export function buildPageHref(
  pathname: string,
  params: Record<string, string | number | undefined | null>,
  opts?: { pageParam?: string; omitPageWhenOne?: boolean },
): string {
  const pageParam = opts?.pageParam ?? "page";
  const omitPageWhenOne = opts?.omitPageWhenOne ?? true;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (omitPageWhenOne && key === pageParam && Number(value) === 1) continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `${pathname}?${s}` : pathname;
}
