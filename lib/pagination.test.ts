import { describe, expect, it } from "vitest";
import { buildPageHref, paginationMeta, parsePage, parsePageSize } from "./pagination";

describe("pagination helpers", () => {
  it("parsePage is 1-based and clamps invalid input", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage("nope")).toBe(1);
  });

  it("parsePageSize only allows listed sizes", () => {
    expect(parsePageSize(undefined)).toBe(10);
    expect(parsePageSize("20")).toBe(20);
    expect(parsePageSize("50")).toBe(50);
    expect(parsePageSize("25")).toBe(10);
    expect(parsePageSize("99")).toBe(10);
  });

  it("paginationMeta computes skip/take and clamps page", () => {
    expect(paginationMeta(45, 2, 20)).toEqual({
      totalPages: 3,
      page: 2,
      skip: 20,
      take: 20,
    });
    expect(paginationMeta(45, 99, 20).page).toBe(3);
    expect(paginationMeta(0, 5, 20)).toEqual({
      totalPages: 1,
      page: 1,
      skip: 0,
      take: 20,
    });
    expect(paginationMeta(19, 1, 10)).toEqual({
      totalPages: 2,
      page: 1,
      skip: 0,
      take: 10,
    });
  });

  it("buildPageHref preserves filters and omits page=1", () => {
    expect(buildPageHref("/admin/contractors", { q: "ada", filter: "pro", page: 1 })).toBe(
      "/admin/contractors?q=ada&filter=pro",
    );
    expect(buildPageHref("/admin/contractors", { q: "ada", page: 2 })).toBe(
      "/admin/contractors?q=ada&page=2",
    );
    expect(
      buildPageHref(
        "/admin/contractors/x",
        { matchesPage: 2, txPage: 1 },
        { pageParam: "txPage" },
      ),
    ).toBe("/admin/contractors/x?matchesPage=2");
  });
});
