import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildPageHref } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export type PaginationParams = Record<string, string | number | undefined | null>;

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  totalCount: number;
  pathname: string;
  /** Other query params to preserve when changing page (e.g. q, filter, topup). */
  params?: PaginationParams;
  pageParam?: string;
  pageSize?: number;
  pageSizeParam?: string;
  pageSizeOptions?: number[];
  className?: string;
  /** Visual variant — admin uses CSS vars; contractor uses Tailwind land palette. */
  variant?: "admin" | "contractor";
};

/**
 * Accessible Prev / Next + "Page X of Y". Optional page-size selector.
 * Links merge existing search params so filters survive pagination.
 */
export function PaginationControls({
  page,
  totalPages,
  totalCount,
  pathname,
  params = {},
  pageParam = "page",
  pageSize,
  pageSizeParam = "pageSize",
  pageSizeOptions = [10, 20, 25, 50],
  className,
  variant = "contractor",
}: PaginationControlsProps) {
  if (totalCount <= 0) return null;

  const base: PaginationParams = { ...params };
  if (pageSize != null) base[pageSizeParam] = pageSize;

  const prevHref =
    page > 1
      ? buildPageHref(pathname, { ...base, [pageParam]: page - 1 }, { pageParam })
      : null;
  const nextHref =
    page < totalPages
      ? buildPageHref(pathname, { ...base, [pageParam]: page + 1 }, { pageParam })
      : null;

  const isAdmin = variant === "admin";

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        !isAdmin && "border-t border-[#EBE3D4] px-1 py-4",
        className,
      )}
      style={
        isAdmin
          ? {
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "14px 24px",
              background: "var(--card2)",
              borderTop: "1px solid var(--line)",
            }
          : undefined
      }
    >
      <p
        className={cn(!isAdmin && "text-[13px] text-[#8A7E68]")}
        style={isAdmin ? { margin: 0, font: "400 13px/1 'Inter'", color: "var(--ink3)" } : undefined}
      >
        Page {page} of {totalPages}
        <span className={cn(!isAdmin && "text-[#A79E8D]")} style={isAdmin ? { color: "var(--ink3)" } : undefined}>
          {" "}
          · {totalCount} total
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {pageSize != null && (
          <PageSizeLinks
            pathname={pathname}
            params={params}
            pageParam={pageParam}
            pageSize={pageSize}
            pageSizeParam={pageSizeParam}
            options={pageSizeOptions}
            variant={variant}
          />
        )}

        <div className="flex items-center gap-1.5">
          <PageLink href={prevHref} disabled={!prevHref} label="Previous page" variant={variant}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Prev
          </PageLink>
          <PageLink href={nextHref} disabled={!nextHref} label="Next page" variant={variant}>
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </PageLink>
        </div>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  variant,
  children,
}: {
  href: string | null;
  disabled: boolean;
  label: string;
  variant: "admin" | "contractor";
  children: React.ReactNode;
}) {
  const isAdmin = variant === "admin";
  const baseClass = cn(
    "inline-flex h-9 items-center gap-1 rounded-[10px] px-3 text-[13px] font-semibold transition-colors",
    !isAdmin &&
      (disabled
        ? "pointer-events-none border border-[#E6DFD1] bg-[#F7F0E3] text-[#B0A691] opacity-60"
        : "border border-[#E6DFD1] bg-white text-[#5A4E3E] hover:bg-[#F7F0E3]"),
  );
  const adminStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    font: "600 13px/1 'Inter'",
    textDecoration: "none",
    border: "1px solid var(--line)",
    background: disabled ? "var(--card2)" : "var(--card)",
    color: disabled ? "var(--ink3)" : "var(--ink)",
    opacity: disabled ? 0.55 : 1,
    pointerEvents: disabled ? "none" : "auto",
  };

  if (disabled || !href) {
    return (
      <span aria-disabled="true" aria-label={label} className={baseClass} style={isAdmin ? adminStyle : undefined}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={baseClass} style={isAdmin ? adminStyle : undefined}>
      {children}
    </Link>
  );
}

function PageSizeLinks({
  pathname,
  params,
  pageParam,
  pageSize,
  pageSizeParam,
  options,
  variant,
}: {
  pathname: string;
  params: PaginationParams;
  pageParam: string;
  pageSize: number;
  pageSizeParam: string;
  options: number[];
  variant: "admin" | "contractor";
}) {
  const isAdmin = variant === "admin";
  return (
    <div
      className={cn("flex items-center gap-1", !isAdmin && "text-[12px] text-[#8A7E68]")}
      style={isAdmin ? { font: "400 12px/1 'Inter'", color: "var(--ink3)" } : undefined}
      role="group"
      aria-label="Results per page"
    >
      <span className="mr-1">Show</span>
      {options.map((size) => {
        const active = size === pageSize;
        const href = buildPageHref(
          pathname,
          { ...params, [pageSizeParam]: size, [pageParam]: 1 },
          { pageParam },
        );
        if (active) {
          return (
            <span
              key={size}
              className={cn(
                "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[12px] font-semibold",
                !isAdmin && "bg-[#F4EAD3] text-[#8A6B2E]",
              )}
              style={
                isAdmin
                  ? {
                      background: "var(--goldSoft)",
                      color: "var(--goldSoftFg)",
                      borderRadius: 8,
                      padding: "0 8px",
                      font: "600 12px/28px 'Inter'",
                    }
                  : undefined
              }
              aria-current="true"
            >
              {size}
            </span>
          );
        }
        return (
          <Link
            key={size}
            href={href}
            className={cn(
              "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[12px] font-medium",
              !isAdmin && "text-[#8A7E68] hover:bg-[#F7F0E3] hover:text-[#5A4E3E]",
            )}
            style={
              isAdmin
                ? {
                    color: "var(--ink2)",
                    borderRadius: 8,
                    padding: "0 8px",
                    font: "500 12px/28px 'Inter'",
                    textDecoration: "none",
                  }
                : undefined
            }
          >
            {size}
          </Link>
        );
      })}
    </div>
  );
}
